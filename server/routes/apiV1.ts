import { Router } from 'express';
import crypto from 'crypto';
import os from 'os';
import { Database } from '../db.ts';
import {
  checkDockerAvailability,
  SUPPORTED_IMAGES,
  getVerifiedImages,
  provisionVmContainer,
  startVmContainer,
  stopVmContainer,
  restartVmContainer,
  deleteVmContainer,
  reinstallVmContainer,
  getContainerLogs,
  startSshxSessionInContainer,
  stopSshxSessionInContainer,
  getActiveSshxSession
} from '../docker.ts';
import {
  authenticateApiKey,
  generateSecureApiKey,
  generateSecureAdminApiKey,
  createJwtToken,
  hashPassword,
  requireAdmin
} from '../auth.ts';
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

// ==========================================
// Authentication System (BusterNodes)
// ==========================================

// Public Login: Email or Username + Password
router.post('/auth/login', rateLimiter({ sensitive: true }), (req, res) => {
  const { email, username, password } = req.body || {};
  const identifier = (email || username || '').trim().toLowerCase();

  if (!identifier || !password) {
    res.status(400).json({
      success: false,
      error: { code: 'INVALID_CREDENTIALS', message: 'Email/username and password are required' }
    });
    return;
  }

  // Lookup user by email or username
  let user = Database.getUserByEmail(identifier);
  if (!user) {
    user = Database.getUserByUsername(identifier);
  }

  if (!user) {
    res.status(401).json({
      success: false,
      error: { code: 'AUTH_FAILED', message: 'Invalid credentials or user account does not exist' }
    });
    return;
  }

  // Check password hash
  const inputHash = hashPassword(password);
  if (user.password_hash !== inputHash && user.password_hash !== password) {
    res.status(401).json({
      success: false,
      error: { code: 'AUTH_FAILED', message: 'Invalid email/username or password' }
    });
    return;
  }

  // Check if account is suspended
  if (user.status === 'suspended') {
    res.status(403).json({
      success: false,
      error: { code: 'ACCOUNT_SUSPENDED', message: 'Your account has been suspended by an administrator. Please contact BusterNodes support.' }
    });
    return;
  }

  const token = createJwtToken(user);
  res.cookie('token', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: false,
    maxAge: 7 * 24 * 60 * 60 * 1000
  });

  res.json({
    success: true,
    data: {
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        status: user.status,
        must_change_password: user.must_change_password === 1,
        assigned_slots: user.assigned_slots || 0
      }
    },
    message: 'Authentication successful'
  });
});

// Public Signup: Normal registration without verification
router.post('/auth/signup', rateLimiter({ sensitive: true }), (req, res) => {
  const { username, email, password } = req.body || {};

  if (!username || typeof username !== 'string' || username.trim().length < 3) {
    res.status(400).json({
      success: false,
      error: { code: 'INVALID_USERNAME', message: 'Username must be at least 3 characters long' }
    });
    return;
  }

  if (!email || typeof email !== 'string' || !email.includes('@')) {
    res.status(400).json({
      success: false,
      error: { code: 'INVALID_EMAIL', message: 'Valid email address is required' }
    });
    return;
  }

  if (!password || typeof password !== 'string' || password.length < 6) {
    res.status(400).json({
      success: false,
      error: { code: 'WEAK_PASSWORD', message: 'Password must be at least 6 characters long' }
    });
    return;
  }

  const cleanUsername = username.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
  const cleanEmail = email.trim().toLowerCase();

  // Check if already taken
  if (Database.getUserByEmail(cleanEmail)) {
    res.status(409).json({
      success: false,
      error: { code: 'EMAIL_IN_USE', message: 'An account with this email address already exists' }
    });
    return;
  }

  if (Database.getUserByUsername(cleanUsername)) {
    res.status(409).json({
      success: false,
      error: { code: 'USERNAME_IN_USE', message: 'Username is already taken' }
    });
    return;
  }

  // Prevent ordinary users from registering as administrators
  const newUser = Database.createUser({
    username: cleanUsername,
    email: cleanEmail,
    password,
    role: 'user',
    status: 'active',
    must_change_password: 0,
    assigned_slots: 0
  });

  const token = createJwtToken(newUser);
  res.cookie('token', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: false,
    maxAge: 7 * 24 * 60 * 60 * 1000
  });

  res.status(201).json({
    success: true,
    data: {
      token,
      user: {
        id: newUser.id,
        username: newUser.username,
        email: newUser.email,
        role: newUser.role,
        status: newUser.status,
        must_change_password: false,
        assigned_slots: newUser.assigned_slots
      }
    },
    message: 'User registered successfully. Welcome to BusterNodes DVM Panel.'
  });
});

// Logout: Clear session cookie
router.post('/auth/logout', (_req, res) => {
  res.clearCookie('token');
  res.json({
    success: true,
    message: 'Logged out successfully'
  });
});

// All following routes require authentication (via Bearer token or panel dashboard session)
const auth = authenticateApiKey({ allowSessionFallback: true });

// Current authenticated user profile
router.get('/auth/me', auth, rateLimiter(), (req, res) => {
  const user = Database.getUserById(req.user!.id);
  if (!user) {
    res.status(404).json({
      success: false,
      error: { code: 'USER_NOT_FOUND', message: 'User profile not found' }
    });
    return;
  }

  res.json({
    success: true,
    data: {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      status: user.status,
      must_change_password: user.must_change_password === 1,
      assigned_slots: user.assigned_slots || 0
    },
    message: 'User profile retrieved'
  });
});

// Password change (mandatory first login or self-service)
router.post('/auth/change-password', auth, rateLimiter({ sensitive: true }), (req, res) => {
  const { current_password, new_password } = req.body || {};

  if (!new_password || typeof new_password !== 'string' || new_password.length < 6) {
    res.status(400).json({
      success: false,
      error: { code: 'INVALID_PASSWORD', message: 'New password must be at least 6 characters long' }
    });
    return;
  }

  const user = Database.getUserByIdWithPassword(req.user!.id);
  if (!user) {
    res.status(404).json({
      success: false,
      error: { code: 'USER_NOT_FOUND', message: 'User not found' }
    });
    return;
  }

  // If user must change password (e.g. first login default admin), or verifies current password
  if (user.must_change_password !== 1) {
    if (!current_password) {
      res.status(400).json({
        success: false,
        error: { code: 'CURRENT_PASSWORD_REQUIRED', message: 'Current password is required to set a new password' }
      });
      return;
    }
    const currentHash = hashPassword(current_password);
    if (user.password_hash !== currentHash && user.password_hash !== current_password) {
      res.status(401).json({
        success: false,
        error: { code: 'AUTH_FAILED', message: 'Current password is incorrect' }
      });
      return;
    }
  }

  Database.changeUserPassword(user.id, new_password);

  res.json({
    success: true,
    data: {
      id: user.id,
      must_change_password: false
    },
    message: 'Password changed successfully. Your account is now secured.'
  });
});


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

// ==========================================
// AutoDeploy Subsystem Endpoints
// ==========================================
router.get('/autodeploy', auth, rateLimiter(), (req, res) => {
  const settings = Database.getAutoDeploySettings();
  const userCheck = Database.canUserDeploy(req.user!.id);

  res.json({
    success: true,
    data: {
      settings,
      user_deployment: userCheck
    },
    message: 'AutoDeploy configuration and user allocation status retrieved'
  });
});

router.put('/autodeploy', auth, rateLimiter({ sensitive: true }), requireAdmin, (req, res) => {
  const {
    autodeploy_enabled,
    total_slots,
    slot_default_cpu,
    slot_default_ram_mb,
    slot_default_disk_gb,
    allowed_templates
  } = req.body || {};

  Database.updateAutoDeploySettings({
    autodeploy_enabled: typeof autodeploy_enabled === 'boolean' ? autodeploy_enabled : undefined,
    total_slots: typeof total_slots === 'number' ? total_slots : undefined,
    slot_default_cpu: typeof slot_default_cpu === 'number' ? slot_default_cpu : undefined,
    slot_default_ram_mb: typeof slot_default_ram_mb === 'number' ? slot_default_ram_mb : undefined,
    slot_default_disk_gb: typeof slot_default_disk_gb === 'number' ? slot_default_disk_gb : undefined,
    allowed_templates: Array.isArray(allowed_templates) ? allowed_templates : undefined
  });

  const updated = Database.getAutoDeploySettings();
  res.json({
    success: true,
    data: updated,
    message: 'AutoDeploy settings updated successfully'
  });
});

// ==========================================
// Admin User & Fleet VM Management Endpoints
// ==========================================
router.get('/admin/users', auth, rateLimiter(), requireAdmin, (_req, res) => {
  const users = Database.listUsers();
  res.json({
    success: true,
    data: users,
    message: `Retrieved ${users.length} registered users`
  });
});

router.post('/admin/users', auth, rateLimiter({ sensitive: true }), requireAdmin, (req, res) => {
  const { username, email, password, role, status, assigned_slots } = req.body || {};

  if (!username || !email || !password) {
    res.status(400).json({
      success: false,
      error: { code: 'INVALID_FIELDS', message: 'Username, email, and password are required' }
    });
    return;
  }

  const cleanEmail = email.trim().toLowerCase();
  const cleanUsername = username.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');

  if (Database.getUserByEmail(cleanEmail)) {
    res.status(409).json({
      success: false,
      error: { code: 'EMAIL_IN_USE', message: 'An account with this email already exists' }
    });
    return;
  }

  const newUser = Database.createUser({
    username: cleanUsername,
    email: cleanEmail,
    password,
    role: role === 'admin' ? 'admin' : 'user',
    status: status === 'suspended' ? 'suspended' : 'active',
    must_change_password: 0,
    assigned_slots: typeof assigned_slots === 'number' ? Math.max(0, assigned_slots) : 1
  });

  res.status(201).json({
    success: true,
    data: newUser,
    message: `User '${cleanUsername}' created successfully by administrator`
  });
});

router.put('/admin/users/:id', auth, rateLimiter(), requireAdmin, (req, res) => {
  const { role, status, assigned_slots, password } = req.body || {};
  const targetUser = Database.getUserById(req.params.id);

  if (!targetUser) {
    res.status(404).json({
      success: false,
      error: { code: 'USER_NOT_FOUND', message: 'Target user does not exist' }
    });
    return;
  }

  // Prevent admin from accidentally demoting or suspending their own active account
  if (targetUser.id === req.user!.id && (role === 'user' || status === 'suspended')) {
    res.status(400).json({
      success: false,
      error: { code: 'CANNOT_DEMOTE_SELF', message: 'You cannot demote or suspend your own active administrator account' }
    });
    return;
  }

  Database.updateUser(targetUser.id, {
    role: role === 'admin' || role === 'user' ? role : undefined,
    status: status === 'active' || status === 'suspended' ? status : undefined,
    assigned_slots: typeof assigned_slots === 'number' ? Math.max(0, assigned_slots) : undefined
  });

  if (password && typeof password === 'string' && password.length >= 6) {
    Database.changeUserPassword(targetUser.id, password);
  }

  const updated = Database.getUserById(targetUser.id);
  res.json({
    success: true,
    data: updated,
    message: `User '${targetUser.username}' updated successfully`
  });
});

router.delete('/admin/users/:id', auth, rateLimiter({ sensitive: true }), requireAdmin, (req, res) => {
  const targetUser = Database.getUserById(req.params.id);
  if (!targetUser) {
    res.status(404).json({
      success: false,
      error: { code: 'USER_NOT_FOUND', message: 'Target user does not exist' }
    });
    return;
  }

  if (targetUser.id === req.user!.id) {
    res.status(400).json({
      success: false,
      error: { code: 'CANNOT_DELETE_SELF', message: 'You cannot delete your own active administrator account' }
    });
    return;
  }

  // Delete all VMs owned by this user
  const userVms = Database.listVms(targetUser.id);
  for (const vm of userVms) {
    deleteVmContainer(vm.container_id).catch(() => {});
    Database.deleteVm(vm.id);
  }

  Database.deleteUser(targetUser.id);

  res.json({
    success: true,
    data: { id: targetUser.id, deleted: true },
    message: `User '${targetUser.username}' and their provisioned instances have been removed`
  });
});

router.get('/admin/vms', auth, rateLimiter(), requireAdmin, (_req, res) => {
  const allVms = Database.listAllVms();
  res.json({
    success: true,
    data: allVms,
    message: `Retrieved ${allVms.length} fleet virtual machine instances`
  });
});

router.post('/admin/vms', auth, rateLimiter({ sensitive: true }), requireAdmin, async (req, res) => {
  const { target_user_id, name, image, cpu, ram_mb, disk_gb, ssh_port, notes } = req.body || {};
  const recipientUserId = target_user_id || req.user!.id;
  const targetUser = Database.getUserById(recipientUserId);

  if (!targetUser) {
    res.status(400).json({
      success: false,
      error: { code: 'INVALID_USER', message: 'Target user to assign this VPS does not exist' }
    });
    return;
  }

  // Requirement 3: Enforce strict One VPS Per User limit
  const userExistingVms = Database.listVms(targetUser.id);
  if (userExistingVms.length >= 1) {
    res.status(400).json({
      success: false,
      error: {
        code: 'USER_ALREADY_HAS_VPS',
        message: `User '${targetUser.username}' already owns an active VPS instance (${userExistingVms[0].name}). Each user is limited to a maximum of 1 VPS instance. Remove or reassign the existing instance before provisioning a new one.`
      }
    });
    return;
  }

  // Check overall node slot capacity
  const autodeploy = Database.getAutoDeploySettings();
  if (autodeploy.available_slots <= 0) {
    res.status(400).json({
      success: false,
      error: {
        code: 'SLOTS_EXHAUSTED',
        message: 'All node VPS deployment slots are currently exhausted. Please increase total_slots in AutoDeploy settings.'
      }
    });
    return;
  }

  const cleanName = (name || `vps-${Date.now().toString(36)}`).trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-');
  const validImages = SUPPORTED_IMAGES.map(i => i.tag);
  const targetImage = validImages.includes(image) ? image : 'nobitaa/ubuntu:24';
  const parsedCpu = parseInt(cpu, 10) || 2;
  const parsedRamMb = parseInt(ram_mb, 10) || 2048;
  const parsedDiskGb = parseInt(disk_gb, 10) || 20;
  const safeSshPort = parseInt(ssh_port, 10) || Database.getNextAvailableSshPort();

  // Ensure target user has at least 1 assigned slot
  if ((targetUser.assigned_slots || 0) < 1) {
    Database.updateUser(targetUser.id, { assigned_slots: 1 });
  }

  try {
    const containerResult = await provisionVmContainer({
      name: cleanName,
      image: targetImage,
      cpu: parsedCpu,
      ram_mb: parsedRamMb,
      ssh_port: safeSshPort
    });

    const vmId = 'vm-' + crypto.randomBytes(4).toString('hex');
    const newVm: VirtualMachine = {
      id: vmId,
      user_id: targetUser.id,
      name: cleanName,
      image: targetImage,
      status: 'running',
      cpu: parsedCpu,
      ram_mb: parsedRamMb,
      disk_gb: parsedDiskGb,
      ssh_port: safeSshPort,
      ip_address: containerResult.ipAddress || 'Unavailable',
      container_id: containerResult.containerId,
      ports: [{ host: safeSshPort, guest: 22, protocol: 'tcp' }],
      notes: typeof notes === 'string' ? notes.slice(0, 500) : 'Provisioned by Admin',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    Database.createVm(newVm);

    res.status(201).json({
      success: true,
      data: newVm,
      message: `Admin successfully provisioned '${cleanName}' assigned to user '${targetUser.username}' on SSH port ${safeSshPort}`
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { code: 'PROVISION_FAILED', message: err.message }
    });
  }
});

// ==========================================
// Virtual Machine Management
// ==========================================
router.get('/vms', auth, rateLimiter(), requirePermission('vms.read'), (req, res) => {
  const vms = Database.listVms(req.user!.id);
  res.json({
    success: true,
    data: vms,
    message: `Retrieved ${vms.length} virtual machine instances`
  });
});

router.get('/vms/:id', auth, rateLimiter(), requirePermission('vms.read'), (req, res) => {
  const isAdmin = req.user?.role === 'admin';
  const vm = isAdmin ? Database.getVmByIdAnyOwner(req.params.id) : Database.getVmById(req.params.id, req.user!.id);
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
  // Requirement 2 & 3: Strict Admin-Only VPS Deployment & AutoDeploy limits
  // Ordinary users must NOT have permission to create VPS instances independently.
  if (req.user?.role !== 'admin') {
    res.status(403).json({
      success: false,
      error: {
        code: 'ADMIN_PROVISIONING_ONLY',
        message: 'Only administrators can create and deploy VPS instances. Please contact your administrator to provision an instance for your account.'
      }
    });
    return;
  }

  const { target_user_id, name, image, cpu, ram_mb, disk_gb, ssh_port, notes, ports } = req.body || {};
  const recipientUserId = target_user_id || req.user!.id;
  const targetUser = Database.getUserById(recipientUserId);

  if (!targetUser) {
    res.status(400).json({
      success: false,
      error: { code: 'INVALID_USER', message: 'Target user to assign this VPS does not exist' }
    });
    return;
  }

  // Requirement 3: Enforce strict One VPS Per User limit
  const userExistingVms = Database.listVms(targetUser.id);
  if (userExistingVms.length >= 1) {
    res.status(400).json({
      success: false,
      error: {
        code: 'USER_ALREADY_HAS_VPS',
        message: `User '${targetUser.username}' already owns an active VPS instance (${userExistingVms[0].name}). Each user is strictly limited to 1 VPS instance.`
      }
    });
    return;
  }

  // AutoDeploy Global Enablement & Slot Capacity Verification
  const autodeploy = Database.getAutoDeploySettings();
  if (!autodeploy.autodeploy_enabled) {
    res.status(403).json({
      success: false,
      error: {
        code: 'AUTODEPLOY_DISABLED',
        message: 'AutoDeploy provisioning is currently disabled by administrator policy.'
      }
    });
    return;
  }

  if (autodeploy.available_slots <= 0) {
    res.status(400).json({
      success: false,
      error: {
        code: 'SLOTS_EXHAUSTED',
        message: 'All VPS deployment slots are currently exhausted. Please increase total_slots in AutoDeploy settings.'
      }
    });
    return;
  }

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

  // Numerical resources
  const parsedCpu = parseInt(cpu, 10);
  if (!parsedCpu || isNaN(parsedCpu) || parsedCpu < 1) {
    res.status(400).json({
      success: false,
      error: { code: 'INVALID_CPU', message: 'CPU allocation must be a positive integer' }
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

  // Capacity Check
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

  // Ensure target user has assigned slot
  if ((targetUser.assigned_slots || 0) < 1) {
    Database.updateUser(targetUser.id, { assigned_slots: 1 });
  }

  try {
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
      user_id: targetUser.id,
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
  const isAdmin = req.user?.role === 'admin';
  const vm = isAdmin ? Database.getVmByIdAnyOwner(req.params.id) : Database.getVmById(req.params.id, req.user!.id);
  if (!vm) {
    res.status(404).json({
      success: false,
      error: { code: 'VM_NOT_FOUND', message: 'Virtual machine not found' }
    });
    return;
  }

  await startVmContainer(vm.container_id);
  Database.updateVmStatus(vm.id, vm.user_id, 'running');

  res.json({
    success: true,
    data: { id: vm.id, status: 'running' },
    message: `Virtual machine '${vm.name}' powered on successfully`
  });
});

router.post('/vms/:id/stop', auth, rateLimiter(), requirePermission('vms.stop'), async (req, res) => {
  const isAdmin = req.user?.role === 'admin';
  const vm = isAdmin ? Database.getVmByIdAnyOwner(req.params.id) : Database.getVmById(req.params.id, req.user!.id);
  if (!vm) {
    res.status(404).json({
      success: false,
      error: { code: 'VM_NOT_FOUND', message: 'Virtual machine not found' }
    });
    return;
  }

  await stopVmContainer(vm.container_id);
  Database.updateVmStatus(vm.id, vm.user_id, 'stopped');

  res.json({
    success: true,
    data: { id: vm.id, status: 'stopped' },
    message: `Virtual machine '${vm.name}' stopped gracefully`
  });
});

router.post('/vms/:id/restart', auth, rateLimiter(), requirePermission('vms.restart'), async (req, res) => {
  const isAdmin = req.user?.role === 'admin';
  const vm = isAdmin ? Database.getVmByIdAnyOwner(req.params.id) : Database.getVmById(req.params.id, req.user!.id);
  if (!vm) {
    res.status(404).json({
      success: false,
      error: { code: 'VM_NOT_FOUND', message: 'Virtual machine not found' }
    });
    return;
  }

  Database.updateVmStatus(vm.id, vm.user_id, 'restarting');
  await restartVmContainer(vm.container_id);
  Database.updateVmStatus(vm.id, vm.user_id, 'running');

  res.json({
    success: true,
    data: { id: vm.id, status: 'running' },
    message: `Virtual machine '${vm.name}' restarted successfully`
  });
});

// Reinstall Operating System & Container
router.post('/vms/:id/reinstall', auth, rateLimiter({ sensitive: true }), requirePermission('vms.create'), async (req, res) => {
  const isAdmin = req.user?.role === 'admin';
  const vm = isAdmin ? Database.getVmByIdAnyOwner(req.params.id) : Database.getVmById(req.params.id, req.user!.id);
  
  if (!vm) {
    res.status(404).json({
      success: false,
      error: { code: 'VM_NOT_FOUND', message: 'Virtual machine not found' }
    });
    return;
  }

  const { image } = req.body || {};
  const targetImage = image && SUPPORTED_IMAGES.some(i => i.tag === image) ? image : vm.image;

  try {
    Database.updateVmStatus(vm.id, vm.user_id, 'restarting');
    
    const result = await reinstallVmContainer(vm.container_id, {
      name: vm.name,
      image: targetImage,
      cpu: vm.cpu,
      ram_mb: vm.ram_mb,
      ssh_port: vm.ssh_port
    });

    Database.updateVmRecord(vm.id, {
      container_id: result.containerId,
      image: targetImage,
      status: 'running'
    });

    const updated = Database.getVmByIdAnyOwner(vm.id);

    res.json({
      success: true,
      data: updated,
      message: `Virtual machine '${vm.name}' wiped and reinstalled with ${targetImage}. Preserved SSH port: ${vm.ssh_port}.`
    });
  } catch (err: any) {
    Database.updateVmStatus(vm.id, vm.user_id, 'stopped');
    res.status(500).json({
      success: false,
      error: { code: 'REINSTALL_FAILED', message: 'Failed to reinstall virtual machine: ' + err.message }
    });
  }
});

// Live Container Logs
router.get('/vms/:id/logs', auth, rateLimiter(), requirePermission('vms.read'), async (req, res) => {
  const isAdmin = req.user?.role === 'admin';
  const vm = isAdmin ? Database.getVmByIdAnyOwner(req.params.id) : Database.getVmById(req.params.id, req.user!.id);
  
  if (!vm) {
    res.status(404).json({
      success: false,
      error: { code: 'VM_NOT_FOUND', message: 'Virtual machine not found' }
    });
    return;
  }

  const logs = await getContainerLogs(vm.container_id);
  res.json({
    success: true,
    data: {
      vm_id: vm.id,
      container_id: vm.container_id,
      logs
    },
    message: 'Container startup and runtime logs retrieved'
  });
});

// SSHX Live Terminal Integration
router.post('/vms/:id/sshx/start', auth, rateLimiter(), requirePermission('vms.start'), async (req, res) => {
  const isAdmin = req.user?.role === 'admin';
  const vm = isAdmin ? Database.getVmByIdAnyOwner(req.params.id) : Database.getVmById(req.params.id, req.user!.id);
  
  if (!vm) {
    res.status(404).json({
      success: false,
      error: { code: 'VM_NOT_FOUND', message: 'Virtual machine not found' }
    });
    return;
  }

  const result = await startSshxSessionInContainer(vm.id, vm.container_id);
  if (!result.success || !result.url) {
    res.status(500).json({
      success: false,
      error: { code: 'SSHX_FAILED', message: result.error || 'Failed to start SSHX session inside container' }
    });
    return;
  }

  res.json({
    success: true,
    data: {
      vm_id: vm.id,
      url: result.url,
      status: 'active'
    },
    message: 'SSHX live session initiated with root access inside container'
  });
});

router.post('/vms/:id/sshx/stop', auth, rateLimiter(), async (req, res) => {
  const isAdmin = req.user?.role === 'admin';
  const vm = isAdmin ? Database.getVmByIdAnyOwner(req.params.id) : Database.getVmById(req.params.id, req.user!.id);
  
  if (!vm) {
    res.status(404).json({
      success: false,
      error: { code: 'VM_NOT_FOUND', message: 'Virtual machine not found' }
    });
    return;
  }

  await stopSshxSessionInContainer(vm.id, vm.container_id);
  res.json({
    success: true,
    data: { vm_id: vm.id, stopped: true },
    message: 'SSHX session terminated'
  });
});

router.get('/vms/:id/sshx', auth, rateLimiter(), async (req, res) => {
  const isAdmin = req.user?.role === 'admin';
  const vm = isAdmin ? Database.getVmByIdAnyOwner(req.params.id) : Database.getVmById(req.params.id, req.user!.id);
  
  if (!vm) {
    res.status(404).json({
      success: false,
      error: { code: 'VM_NOT_FOUND', message: 'Virtual machine not found' }
    });
    return;
  }

  const session = getActiveSshxSession(vm.id);
  res.json({
    success: true,
    data: session ? { active: true, url: session.url, startedAt: session.startedAt } : { active: false },
    message: 'SSHX session status retrieved'
  });
});

router.delete('/vms/:id', auth, rateLimiter({ sensitive: true }), requirePermission('vms.delete'), async (req, res) => {
  const isAdmin = req.user?.role === 'admin';
  const vm = isAdmin ? Database.getVmByIdAnyOwner(req.params.id) : Database.getVmById(req.params.id, req.user!.id);
  if (!vm) {
    res.status(404).json({
      success: false,
      error: { code: 'VM_NOT_FOUND', message: 'Virtual machine not found' }
    });
    return;
  }

  await deleteVmContainer(vm.container_id);
  Database.deleteVm(vm.id, isAdmin ? undefined : req.user!.id);

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
