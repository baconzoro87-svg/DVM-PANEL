import { Router } from 'express';
import crypto from 'crypto';
import os from 'os';
import { Database } from '../db.ts';
import { checkDockerAvailability, SUPPORTED_IMAGES, getVerifiedImages, provisionVmContainer, startVmContainer, stopVmContainer, restartVmContainer, deleteVmContainer } from '../docker.ts';
import { authenticateApiKey, generateSecureApiKey, generateSecureAdminApiKey } from '../auth.ts';
import { requirePermission } from '../permissions.ts';
import { rateLimiter } from '../rateLimiter.ts';
import { OPENAPI_SPEC } from '../openapi.ts';
import { getHostResourceInfo, validateHostCapacity } from '../hostResources.ts';
import type { ApiPermission, VirtualMachine } from '../types.ts';

const router = Router();

// OpenAPI Spec endpoint (publicly readable for documentation)
router.get('/openapi.json', (_req, res) => {
  res.json(OPENAPI_SPEC);
});

// Real Host Resources endpoint
router.get('/resources', (_req, res) => {
  const resources = getHostResourceInfo();
  res.json({
    success: true,
    data: resources,
    message: 'Real host virtualization capacity and allocated resources retrieved'
  });
});

// System Status endpoint (public or authenticated)
router.get('/status', async (_req, res) => {
  const docker = await checkDockerAvailability();
  const uptimeSeconds = Math.floor(process.uptime());
  const resources = getHostResourceInfo();

  res.json({
    success: true,
    data: {
      panel: {
        name: 'DVM Panel',
        brand: 'BusterNodes',
        developer: 'Made by Azmal',
        version: '1.4.2-enterprise',
        status: 'operational',
        uptime_seconds: uptimeSeconds,
        timestamp: new Date().toISOString()
      },
      host: {
        platform: os.platform(),
        arch: os.arch(),
        hostname: os.hostname(),
        cpus: os.cpus().length,
        total_memory_mb: Math.floor(os.totalmem() / (1024 * 1024)),
        free_memory_mb: Math.floor(os.freemem() / (1024 * 1024)),
        load_average: os.loadavg()
      },
      resources,
      docker: {
        available: docker.available,
        version: docker.version,
        socket_detected: docker.socketPresent,
        active_containers: docker.activeContainers,
        mode: docker.mode,
        diagnostics: docker.daemonError || 'Docker virtualization daemon is active and ready for container provisioning.'
      }
    },
    message: 'System and host virtualization status retrieved successfully'
  });
});

// All following routes require authentication (via Bearer token or panel dashboard session)
const auth = authenticateApiKey({ allowSessionFallback: true });

// Overview Dashboard Stats
router.get('/overview', auth, rateLimiter(), (req, res) => {
  const userId = req.user!.id;
  const stats = Database.getApiOverviewStats(userId);
  res.json({
    success: true,
    data: stats,
    message: 'API overview telemetry retrieved successfully'
  });
});

// API Usage & Rate Limit Info
router.get('/usage', auth, rateLimiter(), requirePermission('usage.read'), (req, res) => {
  const userId = req.user!.id;
  const stats = Database.getApiOverviewStats(userId);
  const rateLimitPerMinute = parseInt(Database.getSetting('rate_limit_per_minute', '120'), 10);
  const sensitiveLimit = parseInt(Database.getSetting('sensitive_rate_limit_per_minute', '30'), 10);

  res.json({
    success: true,
    data: {
      api_key_id: req.apiKey?.id || 'session:admin',
      key_prefix: req.apiKey?.key_prefix || 'panel_session',
      requests_today: stats.requests.today,
      total_requests: stats.requests.total,
      failed_requests: stats.requests.failed,
      requests_per_minute: stats.requests.requestsPerMinute,
      limits: {
        standard_rpm: rateLimitPerMinute,
        sensitive_rpm: sensitiveLimit
      },
      quota_status: 'HEALTHY'
    },
    message: 'API usage metrics retrieved'
  });
});

// Supported OS Container Images
router.get('/images', auth, rateLimiter(), async (_req, res) => {
  const images = await getVerifiedImages();
  res.json({
    success: true,
    data: images,
    message: 'Verified VM OS images retrieved successfully'
  });
});

// Virtual Machine Management
router.get('/vms', auth, rateLimiter(), requirePermission('vms.read'), (req, res) => {
  const vms = Database.listVms(req.user!.id);
  res.json({
    success: true,
    data: vms,
    message: `Retrieved ${vms.length} virtual machine instances`
  });
});

router.get('/vms/:id', auth, rateLimiter(), requirePermission('vms.read'), (req, res) => {
  const vm = Database.getVmById(req.params.id, req.user!.id);
  if (!vm) {
    res.status(404).json({
      success: false,
      error: {
        code: 'VM_NOT_FOUND',
        message: `Virtual machine '${req.params.id}' does not exist or does not belong to your account`
      }
    });
    return;
  }
  res.json({
    success: true,
    data: vm,
    message: 'Virtual machine details retrieved'
  });
});

router.post('/vms', auth, rateLimiter({ sensitive: true }), requirePermission('vms.create'), async (req, res) => {
  const { name, image, cpu, ram_mb, disk_gb, ssh_port, notes, ports } = req.body || {};

  // Strict Validation
  if (!name || typeof name !== 'string') {
    res.status(400).json({
      success: false,
      error: { code: 'INVALID_NAME', message: 'VM name is required and must be a string' }
    });
    return;
  }

  const cleanName = name.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-');
  if (cleanName.length < 3 || cleanName.length > 32) {
    res.status(400).json({
      success: false,
      error: { code: 'INVALID_NAME', message: 'VM name must be between 3 and 32 characters (alphanumeric and dashes only)' }
    });
    return;
  }

  const validImages = SUPPORTED_IMAGES.map(i => i.tag);
  if (!image || !validImages.includes(image)) {
    res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_IMAGE',
        message: `Image '${image}' is not supported. Choose from: ${validImages.join(', ')}`
      }
    });
    return;
  }

  // Fully customizable numerical resources
  const parsedCpu = parseInt(cpu, 10);
  if (!parsedCpu || isNaN(parsedCpu) || parsedCpu < 1) {
    res.status(400).json({
      success: false,
      error: { code: 'INVALID_CPU', message: 'CPU allocation must be a positive integer (e.g. 1, 2, 4, 8, 16, 32, 64, or higher)' }
    });
    return;
  }

  const parsedRamMb = parseInt(ram_mb, 10);
  if (!parsedRamMb || isNaN(parsedRamMb) || parsedRamMb < 128) {
    res.status(400).json({
      success: false,
      error: { code: 'INVALID_RAM', message: 'RAM allocation must be at least 128 MB' }
    });
    return;
  }

  const parsedDiskGb = parseInt(disk_gb, 10);
  if (!parsedDiskGb || isNaN(parsedDiskGb) || parsedDiskGb < 1) {
    res.status(400).json({
      success: false,
      error: { code: 'INVALID_DISK', message: 'Root disk allocation must be at least 1 GB' }
    });
    return;
  }

  // Real Host Capacity Validation (Do not silently reduce requested resources!)
  const capacityCheck = validateHostCapacity({
    cpu: parsedCpu,
    ramMb: parsedRamMb,
    diskGb: parsedDiskGb
  });

  if (!capacityCheck.valid) {
    res.status(400).json({
      success: false,
      error: {
        code: 'INSUFFICIENT_HOST_RESOURCES',
        message: capacityCheck.error || 'Requested resources exceed physical host availability'
      }
    });
    return;
  }

  const safeSshPort = parseInt(ssh_port, 10) || Database.getNextAvailableSshPort();

  try {
    // Provision container via safe execFile with exact requested allocations
    const containerResult = await provisionVmContainer({
      name: cleanName,
      image,
      cpu: parsedCpu,
      ram_mb: parsedRamMb,
      ssh_port: safeSshPort
    });

    const vmId = 'vm-' + crypto.randomBytes(4).toString('hex');
    const newVm: VirtualMachine = {
      id: vmId,
      user_id: req.user!.id,
      name: cleanName,
      image,
      status: 'running',
      cpu: parsedCpu,
      ram_mb: parsedRamMb,
      disk_gb: parsedDiskGb,
      ssh_port: safeSshPort,
      ip_address: containerResult.ipAddress || 'Unavailable',
      container_id: containerResult.containerId,
      ports: Array.isArray(ports) ? ports : [{ host: safeSshPort, guest: 22, protocol: 'tcp' }],
      notes: typeof notes === 'string' ? notes.slice(0, 500) : '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    Database.createVm(newVm);

    res.status(201).json({
      success: true,
      data: newVm,
      message: `Virtual machine '${cleanName}' created successfully. SSH port: ${safeSshPort}`
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: {
        code: 'PROVISION_FAILED',
        message: 'Failed to provision virtual machine: ' + err.message
      }
    });
  }
});

router.post('/vms/:id/start', auth, rateLimiter(), requirePermission('vms.start'), async (req, res) => {
  const vm = Database.getVmById(req.params.id, req.user!.id);
  if (!vm) {
    res.status(404).json({
      success: false,
      error: { code: 'VM_NOT_FOUND', message: 'Virtual machine not found' }
    });
    return;
  }

  await startVmContainer(vm.container_id);
  Database.updateVmStatus(vm.id, req.user!.id, 'running');

  res.json({
    success: true,
    data: { id: vm.id, status: 'running' },
    message: `Virtual machine '${vm.name}' powered on successfully`
  });
});

router.post('/vms/:id/stop', auth, rateLimiter(), requirePermission('vms.stop'), async (req, res) => {
  const vm = Database.getVmById(req.params.id, req.user!.id);
  if (!vm) {
    res.status(404).json({
      success: false,
      error: { code: 'VM_NOT_FOUND', message: 'Virtual machine not found' }
    });
    return;
  }

  await stopVmContainer(vm.container_id);
  Database.updateVmStatus(vm.id, req.user!.id, 'stopped');

  res.json({
    success: true,
    data: { id: vm.id, status: 'stopped' },
    message: `Virtual machine '${vm.name}' stopped gracefully`
  });
});

router.post('/vms/:id/restart', auth, rateLimiter(), requirePermission('vms.restart'), async (req, res) => {
  const vm = Database.getVmById(req.params.id, req.user!.id);
  if (!vm) {
    res.status(404).json({
      success: false,
      error: { code: 'VM_NOT_FOUND', message: 'Virtual machine not found' }
    });
    return;
  }

  Database.updateVmStatus(vm.id, req.user!.id, 'restarting');
  await restartVmContainer(vm.container_id);
  Database.updateVmStatus(vm.id, req.user!.id, 'running');

  res.json({
    success: true,
    data: { id: vm.id, status: 'running' },
    message: `Virtual machine '${vm.name}' restarted successfully`
  });
});

router.delete('/vms/:id', auth, rateLimiter({ sensitive: true }), requirePermission('vms.delete'), async (req, res) => {
  const vm = Database.getVmById(req.params.id, req.user!.id);
  if (!vm) {
    res.status(404).json({
      success: false,
      error: { code: 'VM_NOT_FOUND', message: 'Virtual machine not found' }
    });
    return;
  }

  await deleteVmContainer(vm.container_id);
  Database.deleteVm(vm.id, req.user!.id);

  res.json({
    success: true,
    data: { id: vm.id, deleted: true },
    message: `Virtual machine '${vm.name}' destroyed and removed permanently`
  });
});

// ==========================================
// Admin API Key System (Single Master Key for Bot & Automation Integration)
// ==========================================
router.get('/admin/api-key', auth, rateLimiter(), (req, res) => {
  if (req.user?.role !== 'admin') {
    res.status(403).json({
      success: false,
      error: { code: 'FORBIDDEN', message: 'Admin API key configuration is restricted to administrators' }
    });
    return;
  }

  const adminKey = Database.getAdminApiKey();
  if (!adminKey) {
    res.status(404).json({
      success: false,
      error: { code: 'KEY_NOT_FOUND', message: 'Admin API key not initialized' }
    });
    return;
  }

  res.json({
    success: true,
    data: {
      status: adminKey.status,
      key_prefix: adminKey.key_prefix,
      raw_key: adminKey.raw_key,
      created_at: adminKey.created_at,
      last_used_at: adminKey.last_used_at,
      revoked_at: adminKey.revoked_at
    },
    message: 'Admin API key retrieved successfully'
  });
});

router.post('/admin/api-key/generate', auth, rateLimiter({ sensitive: true }), (req, res) => {
  if (req.user?.role !== 'admin') {
    res.status(403).json({
      success: false,
      error: { code: 'FORBIDDEN', message: 'Only administrators can generate or rotate the API key' }
    });
    return;
  }

  const { fullKey, keyPrefix, keyHash } = generateSecureAdminApiKey();
  const updated = Database.setAdminApiKey(fullKey, keyPrefix, keyHash);

  res.json({
    success: true,
    data: {
      status: updated.status,
      key_prefix: updated.key_prefix,
      raw_key: updated.raw_key,
      created_at: updated.created_at,
      last_used_at: updated.last_used_at
    },
    message: 'New BusterNodes Master Admin API key generated successfully. The previous key was invalidated.'
  });
});

router.post('/admin/api-key/revoke', auth, rateLimiter(), (req, res) => {
  if (req.user?.role !== 'admin') {
    res.status(403).json({
      success: false,
      error: { code: 'FORBIDDEN', message: 'Only administrators can revoke the API key' }
    });
    return;
  }

  Database.revokeAdminApiKey();
  const adminKey = Database.getAdminApiKey();

  res.json({
    success: true,
    data: {
      status: 'revoked',
      key_prefix: adminKey?.key_prefix,
      revoked_at: adminKey?.revoked_at
    },
    message: 'BusterNodes Admin API key revoked immediately. All external bot and script requests will be rejected.'
  });
});

router.post('/admin/api-key/enable', auth, rateLimiter(), (req, res) => {
  if (req.user?.role !== 'admin') {
    res.status(403).json({
      success: false,
      error: { code: 'FORBIDDEN', message: 'Only administrators can re-enable the API key' }
    });
    return;
  }

  Database.enableAdminApiKey();
  const adminKey = Database.getAdminApiKey();

  res.json({
    success: true,
    data: {
      status: 'active',
      key_prefix: adminKey?.key_prefix,
      raw_key: adminKey?.raw_key
    },
    message: 'BusterNodes Admin API key re-enabled successfully.'
  });
});

router.get('/admin/api-logs', auth, rateLimiter(), (req, res) => {
  if (req.user?.role !== 'admin') {
    res.status(403).json({
      success: false,
      error: { code: 'FORBIDDEN', message: 'Access denied' }
    });
    return;
  }

  const result = Database.listApiLogs({ limit: 25 });
  res.json({
    success: true,
    data: result.rows,
    message: 'Recent API activity logs retrieved'
  });
});

// API Key Management Endpoints
router.get('/api-keys', auth, rateLimiter(), requirePermission('api.keys.read'), (req, res) => {
  const keys = Database.listApiKeys(req.user!.id);
  res.json({
    success: true,
    data: keys,
    message: `Retrieved ${keys.length} API keys`
  });
});

router.post('/api-keys', auth, rateLimiter({ sensitive: true }), requirePermission('api.keys.manage'), (req, res) => {
  const { name, permissions, expires_in_days, description } = req.body || {};

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    res.status(400).json({
      success: false,
      error: { code: 'INVALID_NAME', message: 'API key name is required' }
    });
    return;
  }

  if (!Array.isArray(permissions) || permissions.length === 0) {
    res.status(400).json({
      success: false,
      error: { code: 'INVALID_PERMISSIONS', message: 'At least one granular permission must be assigned' }
    });
    return;
  }

  const validPerms: ApiPermission[] = [
    'vms.read', 'vms.create', 'vms.start', 'vms.stop', 'vms.restart', 'vms.delete',
    'images.read', 'usage.read', 'api.keys.read', 'api.keys.manage'
  ];

  for (const p of permissions) {
    if (!validPerms.includes(p)) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_PERMISSION', message: `Unknown permission: '${p}'` }
      });
      return;
    }
  }

  let expiresAt: string | null = null;
  if (expires_in_days && typeof expires_in_days === 'number' && expires_in_days > 0) {
    expiresAt = new Date(Date.now() + expires_in_days * 86400000).toISOString();
  }

  const keyId = 'key_' + crypto.randomBytes(6).toString('hex');
  const { fullKey, keyPrefix, keyHash } = generateSecureApiKey();

  Database.createApiKey({
    id: keyId,
    userId: req.user!.id,
    name: name.trim().slice(0, 60),
    keyPrefix,
    keyHash,
    permissions,
    expiresAt,
    description: typeof description === 'string' ? description.slice(0, 200) : ''
  });

  // CRITICAL SECURITY REQUIREMENT:
  // Return the full unhashed API key ONLY ONCE here. It is NEVER retrievable again!
  res.status(201).json({
    success: true,
    data: {
      id: keyId,
      name: name.trim(),
      key_prefix: keyPrefix,
      raw_key: fullKey, // One-time disclosure
      permissions,
      expires_at: expiresAt,
      created_at: new Date().toISOString()
    },
    message: 'API key created successfully. Save your raw API key now; you will not be able to see it again.'
  });
});

router.post('/api-keys/:id/revoke', auth, rateLimiter(), requirePermission('api.keys.manage'), (req, res) => {
  const success = Database.revokeApiKey(req.params.id, req.user!.id);
  if (!success) {
    res.status(404).json({
      success: false,
      error: { code: 'KEY_NOT_FOUND', message: 'API key not found or not owned by user' }
    });
    return;
  }

  res.json({
    success: true,
    data: { id: req.params.id, revoked: true },
    message: 'API key revoked immediately. All future requests with this key will be rejected.'
  });
});

router.post('/api-keys/:id/regenerate', auth, rateLimiter({ sensitive: true }), requirePermission('api.keys.manage'), (req, res) => {
  const existingKey = Database.getApiKeyById(req.params.id, req.user!.id);
  if (!existingKey) {
    res.status(404).json({
      success: false,
      error: { code: 'KEY_NOT_FOUND', message: 'API key not found or not owned by user' }
    });
    return;
  }

  // Revoke old key
  Database.revokeApiKey(existingKey.id, req.user!.id);

  // Create new key with identical name and permissions
  const newKeyId = 'key_' + crypto.randomBytes(6).toString('hex');
  const { fullKey, keyPrefix, keyHash } = generateSecureApiKey();

  Database.createApiKey({
    id: newKeyId,
    userId: req.user!.id,
    name: `${existingKey.name} (Regenerated)`,
    keyPrefix,
    keyHash,
    permissions: existingKey.permissions,
    expiresAt: existingKey.expires_at,
    description: existingKey.description
  });

  res.json({
    success: true,
    data: {
      id: newKeyId,
      old_key_id: existingKey.id,
      name: `${existingKey.name} (Regenerated)`,
      key_prefix: keyPrefix,
      raw_key: fullKey, // One-time disclosure
      permissions: existingKey.permissions,
      expires_at: existingKey.expires_at,
      created_at: new Date().toISOString()
    },
    message: 'Previous key revoked and new API key generated. Save this new key now.'
  });
});

router.delete('/api-keys/:id', auth, rateLimiter({ sensitive: true }), requirePermission('api.keys.manage'), (req, res) => {
  const success = Database.deleteApiKey(req.params.id, req.user!.id);
  if (!success) {
    res.status(404).json({
      success: false,
      error: { code: 'KEY_NOT_FOUND', message: 'API key not found or not owned by user' }
    });
    return;
  }

  res.json({
    success: true,
    data: { id: req.params.id, deleted: true },
    message: 'API key deleted permanently'
  });
});

// Activity Logs endpoint
router.get('/logs', auth, rateLimiter(), requirePermission('api.keys.read'), (req, res) => {
  const { endpoint, statusGroup, limit, offset, keyId } = req.query as any;

  const result = Database.listApiLogs({
    userId: req.user!.id,
    keyId: typeof keyId === 'string' ? keyId : undefined,
    endpoint: typeof endpoint === 'string' ? endpoint : undefined,
    statusGroup: ['all', '2xx', '4xx', '5xx'].includes(statusGroup) ? statusGroup : 'all',
    limit: Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200),
    offset: Math.max(parseInt(offset, 10) || 0, 0)
  });

  res.json({
    success: true,
    data: result,
    message: `Retrieved ${result.rows.length} request logs`
  });
});

// Settings endpoints
router.get('/settings', auth, rateLimiter(), (_req, res) => {
  const settings = Database.getAllSettings();
  res.json({
    success: true,
    data: settings,
    message: 'API configuration settings retrieved'
  });
});

router.put('/settings', auth, rateLimiter({ sensitive: true }), (req, res) => {
  const updates = req.body || {};
  for (const [k, v] of Object.entries(updates)) {
    if (typeof v === 'string') {
      Database.updateSetting(k, v);
    }
  }
  const updated = Database.getAllSettings();
  res.json({
    success: true,
    data: updated,
    message: 'API configuration settings saved successfully'
  });
});

export default router;
