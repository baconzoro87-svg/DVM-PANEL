import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import type { User, ApiKeyRecord, ApiLogRecord, VirtualMachine, ApiPermission, AdminApiKeyRecord, AutoDeploySettings } from './types.ts';

const DB_PATH = path.resolve(process.cwd(), 'dvm_panel.sqlite');

let db: DatabaseSync;

try {
  db = new DatabaseSync(DB_PATH);
} catch (err) {
  console.warn('Failed to open disk database, falling back to in-memory database:', err);
  db = new DatabaseSync(':memory:');
}

// Enable WAL mode and foreign keys for high throughput and durability
try {
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');
} catch (e) {
  // Ignore in memory
}

export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      email TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS api_keys (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      key_prefix TEXT NOT NULL,
      key_hash TEXT NOT NULL UNIQUE,
      permissions TEXT NOT NULL,
      created_at TEXT NOT NULL,
      expires_at TEXT,
      last_used_at TEXT,
      is_revoked INTEGER NOT NULL DEFAULT 0,
      revoked_at TEXT,
      description TEXT DEFAULT '',
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash);
    CREATE INDEX IF NOT EXISTS idx_api_keys_user ON api_keys(user_id);

    CREATE TABLE IF NOT EXISTS api_logs (
      id TEXT PRIMARY KEY,
      api_key_id TEXT,
      key_prefix TEXT,
      user_id TEXT,
      endpoint TEXT NOT NULL,
      method TEXT NOT NULL,
      status_code INTEGER NOT NULL,
      duration_ms INTEGER NOT NULL,
      ip_address TEXT NOT NULL,
      error_code TEXT,
      timestamp TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON api_logs(timestamp);
    CREATE INDEX IF NOT EXISTS idx_logs_key_id ON api_logs(api_key_id);
    CREATE INDEX IF NOT EXISTS idx_logs_user_id ON api_logs(user_id);

    CREATE TABLE IF NOT EXISTS vms (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      image TEXT NOT NULL,
      status TEXT NOT NULL,
      cpu INTEGER NOT NULL,
      ram_mb INTEGER NOT NULL,
      disk_gb INTEGER NOT NULL,
      ssh_port INTEGER NOT NULL,
      ip_address TEXT NOT NULL,
      container_id TEXT,
      ports TEXT NOT NULL DEFAULT '[]',
      notes TEXT DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_vms_user_id ON vms(user_id);

    CREATE TABLE IF NOT EXISTS api_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS admin_api_key (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      key_prefix TEXT NOT NULL,
      key_hash TEXT NOT NULL,
      raw_key TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL,
      last_used_at TEXT,
      revoked_at TEXT
    );
  `);

  // Safe schema migrations for user enhancements
  try { db.exec("ALTER TABLE users ADD COLUMN status TEXT NOT NULL DEFAULT 'active'"); } catch {}
  try { db.exec("ALTER TABLE users ADD COLUMN must_change_password INTEGER NOT NULL DEFAULT 0"); } catch {}
  try { db.exec("ALTER TABLE users ADD COLUMN assigned_slots INTEGER NOT NULL DEFAULT 0"); } catch {}

  seedInitialData();
}

function seedInitialData() {
  // Ensure default administrator exists (admin@dvm.io / Admin213)
  const adminEmail = 'admin@dvm.io';
  const defaultAdminHash = crypto.createHash('sha256').update('Admin213').digest('hex');

  const checkAdmin = db.prepare("SELECT id, email, username, password_hash, must_change_password FROM users WHERE email = ? OR username = 'admin'").get(adminEmail) as { id: string; email: string; username: string; password_hash: string; must_change_password: number } | undefined;

  if (checkAdmin) {
    if (checkAdmin.email !== adminEmail || checkAdmin.username !== 'admin') {
      db.prepare(`
        UPDATE users 
        SET email = ?, username = 'admin', role = 'admin', status = 'active'
        WHERE id = ?
      `).run(adminEmail, checkAdmin.id);
    }
  } else {
    const adminId = 'usr_admin_master';
    db.prepare(`
      INSERT INTO users (id, username, email, password_hash, role, status, must_change_password, assigned_slots, created_at)
      VALUES (?, 'admin', ?, ?, 'admin', 'active', 1, 50, ?)
    `).run(adminId, adminEmail, defaultAdminHash, new Date().toISOString());
  }


  // Ensure default API & AutoDeploy settings exist
  const defaultSettings: Record<string, string> = {
    'rate_limit_per_minute': '120',
    'sensitive_rate_limit_per_minute': '30',
    'default_key_expiry_days': '90',
    'require_ip_allowlist': 'false',
    'allowed_ip_cidrs': '0.0.0.0/0',
    'alert_on_rate_limit': 'true',
    'webhook_alert_url': '',
    'allow_resource_overcommit': 'false',
    'autodeploy_enabled': 'true',
    'total_slots': '20',
    'slot_default_cpu': '2',
    'slot_default_ram_mb': '2048',
    'allowed_templates': JSON.stringify([
      'nobitaa/ubuntu:24',
      'nobitaa/ubuntu:22',
      'nobitaa/debain:13',
      'nobitaa/debain:12',
      'nobitaa/debain:11',
      'ubuntu:24.04',
      'ubuntu:22.04',
      'debian:12',
      'alpine:3.20'
    ])
  };

  for (const [key, val] of Object.entries(defaultSettings)) {
    const existing = db.prepare('SELECT key FROM api_settings WHERE key = ?').get(key);
    if (!existing) {
      db.prepare('INSERT INTO api_settings (key, value) VALUES (?, ?)').run(key, val);
    }
  }

  // Ensure single master Admin API key exists (strictly one key for BusterNodes panel integration)
  const existingAdminKey = db.prepare('SELECT id FROM admin_api_key WHERE id = 1').get();
  if (!existingAdminKey) {
    const rawKey = 'dvm_admin_busternodes_master_key_99x';
    const hash = crypto.createHash('sha256').update(rawKey).digest('hex');
    const prefix = 'dvm_admin_busternodes...99x';

    db.prepare(`
      INSERT INTO admin_api_key (id, key_prefix, key_hash, raw_key, status, created_at, last_used_at, revoked_at)
      VALUES (1, ?, ?, ?, 'active', ?, null, null)
    `).run(prefix, hash, rawKey, new Date().toISOString());
  }
}

// Database query helpers
export const Database = {
  raw: () => db,

  getUserById: (id: string): User | undefined => {
    return db.prepare(`
      SELECT id, username, email, role, 
             COALESCE(status, 'active') as status, 
             COALESCE(must_change_password, 0) as must_change_password, 
             COALESCE(assigned_slots, 0) as assigned_slots, 
             created_at 
      FROM users WHERE id = ?
    `).get(id) as User | undefined;
  },

  getUserByEmail: (email: string): (User & { password_hash: string }) | undefined => {
    const normalized = email.trim().toLowerCase();
    return db.prepare(`
      SELECT id, username, email, password_hash, role, 
             COALESCE(status, 'active') as status, 
             COALESCE(must_change_password, 0) as must_change_password, 
             COALESCE(assigned_slots, 0) as assigned_slots, 
             created_at 
      FROM users WHERE LOWER(email) = ? OR LOWER(username) = ?
    `).get(normalized, normalized) as (User & { password_hash: string }) | undefined;
  },

  getUserByUsername: (username: string): (User & { password_hash: string }) | undefined => {
    return Database.getUserByEmail(username);
  },

  getUserByIdWithPassword: (id: string): (User & { password_hash: string }) | undefined => {
    return db.prepare(`
      SELECT id, username, email, password_hash, role, 
             COALESCE(status, 'active') as status, 
             COALESCE(must_change_password, 0) as must_change_password, 
             COALESCE(assigned_slots, 0) as assigned_slots, 
             created_at 
      FROM users WHERE id = ?
    `).get(id) as (User & { password_hash: string }) | undefined;
  },

  listUsers: (): (User & { vms_count: number })[] => {
    const rows = db.prepare(`
      SELECT u.id, u.username, u.email, u.role, 
             COALESCE(u.status, 'active') as status, 
             COALESCE(u.must_change_password, 0) as must_change_password, 
             COALESCE(u.assigned_slots, 0) as assigned_slots, 
             u.created_at,
             COUNT(v.id) as vms_count
      FROM users u
      LEFT JOIN vms v ON v.user_id = u.id
      GROUP BY u.id
      ORDER BY u.created_at DESC
    `).all() as any[];

    return rows.map(r => ({
      ...r,
      vms_count: Number(r.vms_count || 0)
    }));
  },

  createUser: (user: {
    id?: string;
    username: string;
    email: string;
    password_hash?: string;
    password?: string;
    role: 'admin' | 'user';
    status: 'active' | 'suspended';
    must_change_password?: number;
    assigned_slots?: number;
  }): User => {
    const userId = user.id || 'usr_' + crypto.randomBytes(6).toString('hex');
    const hash = user.password_hash || (user.password ? crypto.createHash('sha256').update(user.password).digest('hex') : '');
    const mustChange = user.must_change_password ?? 0;
    const slots = user.assigned_slots ?? 0;
    const createdAt = new Date().toISOString();

    db.prepare(`
      INSERT INTO users (id, username, email, password_hash, role, status, must_change_password, assigned_slots, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      userId,
      user.username.trim(),
      user.email.trim().toLowerCase(),
      hash,
      user.role,
      user.status,
      mustChange,
      slots,
      createdAt
    );

    return {
      id: userId,
      username: user.username.trim(),
      email: user.email.trim().toLowerCase(),
      role: user.role,
      status: user.status,
      must_change_password: mustChange,
      assigned_slots: slots,
      created_at: createdAt
    };
  },


  updateUser: (id: string, updates: { role?: 'admin' | 'user'; status?: 'active' | 'suspended'; assigned_slots?: number }): boolean => {
    const fields: string[] = [];
    const values: any[] = [];
    if (updates.role) { fields.push('role = ?'); values.push(updates.role); }
    if (updates.status) { fields.push('status = ?'); values.push(updates.status); }
    if (typeof updates.assigned_slots === 'number') { fields.push('assigned_slots = ?'); values.push(updates.assigned_slots); }

    if (fields.length === 0) return true;
    values.push(id);
    const res = db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    return res.changes > 0;
  },

  deleteUser: (id: string): boolean => {
    const res = db.prepare('DELETE FROM users WHERE id = ?').run(id);
    return res.changes > 0;
  },

  changeUserPassword: (userId: string, newHash: string): boolean => {
    const res = db.prepare('UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?').run(newHash, userId);
    return res.changes > 0;
  },

  getDefaultAdmin: (): User => {
    const user = Database.getUserByEmail('admin@dvm.io') || Database.getUserById('usr_admin_master');
    if (!user) {
      const fallback = db.prepare("SELECT * FROM users WHERE role = 'admin' LIMIT 1").get() as User | undefined;
      if (fallback) return fallback;
      throw new Error('Default admin not found');
    }
    return user;
  },

  // Single Admin API Key System for Bot & Automation Integration
  getAdminApiKey: (): AdminApiKeyRecord | undefined => {
    return db.prepare('SELECT id, key_prefix, key_hash, raw_key, status, created_at, last_used_at, revoked_at FROM admin_api_key WHERE id = 1').get() as AdminApiKeyRecord | undefined;
  },

  setAdminApiKey: (rawKey: string, keyPrefix: string, keyHash: string): AdminApiKeyRecord => {
    db.prepare(`
      INSERT INTO admin_api_key (id, key_prefix, key_hash, raw_key, status, created_at, last_used_at, revoked_at)
      VALUES (1, ?, ?, ?, 'active', ?, null, null)
      ON CONFLICT(id) DO UPDATE SET
        key_prefix = excluded.key_prefix,
        key_hash = excluded.key_hash,
        raw_key = excluded.raw_key,
        status = 'active',
        created_at = excluded.created_at,
        last_used_at = null,
        revoked_at = null
    `).run(keyPrefix, keyHash, rawKey, new Date().toISOString());
    return Database.getAdminApiKey()!;
  },

  revokeAdminApiKey: (): boolean => {
    const res = db.prepare(`
      UPDATE admin_api_key
      SET status = 'revoked', revoked_at = ?
      WHERE id = 1
    `).run(new Date().toISOString());
    return res.changes > 0;
  },

  enableAdminApiKey: (): boolean => {
    const res = db.prepare(`
      UPDATE admin_api_key
      SET status = 'active', revoked_at = null
      WHERE id = 1
    `).run();
    return res.changes > 0;
  },

  updateAdminApiKeyLastUsed: (): void => {
    db.prepare('UPDATE admin_api_key SET last_used_at = ? WHERE id = 1').run(new Date().toISOString());
  },

  // API Key Queries
  getApiKeyByHash: (hash: string): ApiKeyRecord | undefined => {
    const row = db.prepare('SELECT * FROM api_keys WHERE key_hash = ?').get(hash) as any;
    if (!row) return undefined;
    return {
      ...row,
      permissions: JSON.parse(row.permissions || '[]')
    };
  },

  getApiKeyById: (id: string, userId?: string): ApiKeyRecord | undefined => {
    let query = 'SELECT * FROM api_keys WHERE id = ?';
    const params: any[] = [id];
    if (userId) {
      query += ' AND user_id = ?';
      params.push(userId);
    }
    const row = db.prepare(query).get(...params) as any;
    if (!row) return undefined;
    return {
      ...row,
      permissions: JSON.parse(row.permissions || '[]')
    };
  },

  listApiKeys: (userId: string): Omit<ApiKeyRecord, 'key_hash'>[] => {
    const rows = db.prepare(`
      SELECT id, user_id, name, key_prefix, permissions, created_at, expires_at, last_used_at, is_revoked, revoked_at, description
      FROM api_keys
      WHERE user_id = ?
      ORDER BY created_at DESC
    `).all(userId) as any[];

    return rows.map(r => ({
      ...r,
      permissions: JSON.parse(r.permissions || '[]')
    }));
  },

  createApiKey: (record: {
    id: string;
    userId: string;
    name: string;
    keyPrefix: string;
    keyHash: string;
    permissions: ApiPermission[];
    expiresAt: string | null;
    description?: string;
  }) => {
    db.prepare(`
      INSERT INTO api_keys (id, user_id, name, key_prefix, key_hash, permissions, created_at, expires_at, is_revoked, description)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
    `).run(
      record.id,
      record.userId,
      record.name,
      record.keyPrefix,
      record.keyHash,
      JSON.stringify(record.permissions),
      new Date().toISOString(),
      record.expiresAt,
      record.description || ''
    );
  },

  updateKeyLastUsed: (id: string) => {
    db.prepare('UPDATE api_keys SET last_used_at = ? WHERE id = ?').run(new Date().toISOString(), id);
  },

  revokeApiKey: (id: string, userId: string): boolean => {
    const res = db.prepare(`
      UPDATE api_keys
      SET is_revoked = 1, revoked_at = ?
      WHERE id = ? AND user_id = ?
    `).run(new Date().toISOString(), id, userId);
    return res.changes > 0;
  },

  deleteApiKey: (id: string, userId: string): boolean => {
    const res = db.prepare('DELETE FROM api_keys WHERE id = ? AND user_id = ?').run(id, userId);
    return res.changes > 0;
  },

  // API Logs Queries
  logApiRequest: (log: Omit<ApiLogRecord, 'id'>) => {
    const id = 'log_' + crypto.randomBytes(8).toString('hex');
    db.prepare(`
      INSERT INTO api_logs (id, api_key_id, key_prefix, user_id, endpoint, method, status_code, duration_ms, ip_address, error_code, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      log.api_key_id,
      log.key_prefix,
      log.user_id,
      log.endpoint,
      log.method,
      log.status_code,
      log.duration_ms,
      log.ip_address,
      log.error_code,
      log.timestamp
    );
  },

  listApiLogs: (options: {
    userId?: string;
    keyId?: string;
    endpoint?: string;
    statusGroup?: 'all' | '2xx' | '4xx' | '5xx';
    limit?: number;
    offset?: number;
  }) => {
    let whereClauses: string[] = [];
    const params: any[] = [];

    if (options.userId) {
      whereClauses.push('user_id = ?');
      params.push(options.userId);
    }
    if (options.keyId) {
      whereClauses.push('api_key_id = ?');
      params.push(options.keyId);
    }
    if (options.endpoint) {
      whereClauses.push('endpoint LIKE ?');
      params.push(`%${options.endpoint}%`);
    }
    if (options.statusGroup && options.statusGroup !== 'all') {
      if (options.statusGroup === '2xx') {
        whereClauses.push('status_code >= 200 AND status_code < 300');
      } else if (options.statusGroup === '4xx') {
        whereClauses.push('status_code >= 400 AND status_code < 500');
      } else if (options.statusGroup === '5xx') {
        whereClauses.push('status_code >= 500');
      }
    }

    const whereSql = whereClauses.length > 0 ? 'WHERE ' + whereClauses.join(' AND ') : '';
    const countSql = `SELECT COUNT(*) as total FROM api_logs ${whereSql}`;
    const total = (db.prepare(countSql).get(...params) as { total: number }).total;

    const limit = options.limit || 50;
    const offset = options.offset || 0;

    const dataSql = `
      SELECT * FROM api_logs
      ${whereSql}
      ORDER BY timestamp DESC
      LIMIT ? OFFSET ?
    `;
    const rows = db.prepare(dataSql).all(...params, limit, offset) as unknown as ApiLogRecord[];

    return { total, rows, limit, offset };
  },

  getApiOverviewStats: (userId: string) => {
    const todayIso = new Date(Date.now() - 86400000).toISOString();

    const keysTotal = (db.prepare('SELECT COUNT(*) as count FROM api_keys WHERE user_id = ?').get(userId) as any).count;
    const keysActive = (db.prepare('SELECT COUNT(*) as count FROM api_keys WHERE user_id = ? AND is_revoked = 0 AND (expires_at IS NULL OR expires_at > ?)').get(userId, new Date().toISOString()) as any).count;
    const keysRevoked = (db.prepare('SELECT COUNT(*) as count FROM api_keys WHERE user_id = ? AND is_revoked = 1').get(userId) as any).count;

    const reqTotal = (db.prepare('SELECT COUNT(*) as count FROM api_logs WHERE user_id = ?').get(userId) as any).count;
    const reqToday = (db.prepare('SELECT COUNT(*) as count FROM api_logs WHERE user_id = ? AND timestamp >= ?').get(userId, todayIso) as any).count;
    const reqFailed = (db.prepare('SELECT COUNT(*) as count FROM api_logs WHERE user_id = ? AND status_code >= 400').get(userId) as any).count;

    // Requests per minute over the last 15 minutes
    const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const recentRequestsCount = (db.prepare('SELECT COUNT(*) as count FROM api_logs WHERE user_id = ? AND timestamp >= ?').get(userId, fifteenMinAgo) as any).count;
    const requestsPerMinute = Number((recentRequestsCount / 15).toFixed(2));

    // Endpoint breakdown
    const topEndpoints = db.prepare(`
      SELECT endpoint, method, COUNT(*) as count, AVG(duration_ms) as avg_duration
      FROM api_logs
      WHERE user_id = ?
      GROUP BY endpoint, method
      ORDER BY count DESC
      LIMIT 6
    `).all(userId) as any[];

    // Hourly request breakdown for past 24 hours
    const hourlyLogs = db.prepare(`
      SELECT strftime('%H:00', timestamp) as hour_label,
             COUNT(*) as total_requests,
             SUM(CASE WHEN status_code >= 400 THEN 1 ELSE 0 END) as failed_requests
      FROM api_logs
      WHERE user_id = ? AND timestamp >= ?
      GROUP BY hour_label
      ORDER BY timestamp ASC
    `).all(userId, todayIso) as any[];

    // Recent 5 activity logs
    const recentLogs = db.prepare(`
      SELECT * FROM api_logs
      WHERE user_id = ?
      ORDER BY timestamp DESC
      LIMIT 5
    `).all(userId) as unknown as ApiLogRecord[];

    return {
      keys: {
        total: keysTotal,
        active: keysActive,
        revoked: keysRevoked
      },
      requests: {
        total: reqTotal,
        today: reqToday,
        failed: reqFailed,
        requestsPerMinute
      },
      topEndpoints,
      hourlyBreakdown: hourlyLogs,
      recentActivity: recentLogs
    };
  },

  // Virtual Machine Queries
  listAllVms: (): (VirtualMachine & { owner_email: string; owner_username: string })[] => {
    const rows = db.prepare(`
      SELECT v.*, u.email as owner_email, u.username as owner_username
      FROM vms v
      LEFT JOIN users u ON u.id = v.user_id
      ORDER BY v.created_at DESC
    `).all() as any[];
    return rows.map(r => ({
      ...r,
      ports: JSON.parse(r.ports || '[]')
    }));
  },

  listVms: (userId: string): VirtualMachine[] => {
    const rows = db.prepare('SELECT * FROM vms WHERE user_id = ? ORDER BY created_at DESC').all(userId) as any[];
    return rows.map(r => ({
      ...r,
      ports: JSON.parse(r.ports || '[]')
    }));
  },

  getVmById: (id: string, userId: string): VirtualMachine | undefined => {
    const row = db.prepare('SELECT * FROM vms WHERE id = ? AND user_id = ?').get(id, userId) as any;
    if (!row) return undefined;
    return {
      ...row,
      ports: JSON.parse(row.ports || '[]')
    };
  },

  getVmByIdAnyOwner: (id: string): (VirtualMachine & { owner_email?: string }) | undefined => {
    const row = db.prepare(`
      SELECT v.*, u.email as owner_email 
      FROM vms v 
      LEFT JOIN users u ON u.id = v.user_id 
      WHERE v.id = ?
    `).get(id) as any;
    if (!row) return undefined;
    return {
      ...row,
      ports: JSON.parse(row.ports || '[]')
    };
  },

  createVm: (vm: VirtualMachine) => {
    db.prepare(`
      INSERT INTO vms (id, user_id, name, image, status, cpu, ram_mb, disk_gb, ssh_port, ip_address, container_id, ports, notes, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      vm.id,
      vm.user_id,
      vm.name,
      vm.image,
      vm.status,
      vm.cpu,
      vm.ram_mb,
      vm.disk_gb,
      vm.ssh_port,
      vm.ip_address,
      vm.container_id,
      JSON.stringify(vm.ports || []),
      vm.notes || '',
      vm.created_at,
      vm.updated_at
    );
  },

  updateVmStatus: (id: string, userId: string | undefined, status: 'running' | 'stopped' | 'restarting' | 'error') => {
    if (userId) {
      db.prepare(`
        UPDATE vms
        SET status = ?, updated_at = ?
        WHERE id = ? AND user_id = ?
      `).run(status, new Date().toISOString(), id, userId);
    } else {
      db.prepare(`
        UPDATE vms
        SET status = ?, updated_at = ?
        WHERE id = ?
      `).run(status, new Date().toISOString(), id);
    }
  },

  updateVmContainerInfo: (id: string, containerId: string | null, ipAddress: string) => {
    db.prepare(`
      UPDATE vms
      SET container_id = ?, ip_address = ?, updated_at = ?
      WHERE id = ?
    `).run(containerId, ipAddress, new Date().toISOString(), id);
  },

  updateVmRecord: (id: string, updates: Partial<VirtualMachine>): boolean => {
    const fields: string[] = [];
    const values: any[] = [];
    if (updates.container_id !== undefined) { fields.push('container_id = ?'); values.push(updates.container_id); }
    if (updates.image !== undefined) { fields.push('image = ?'); values.push(updates.image); }
    if (updates.status !== undefined) { fields.push('status = ?'); values.push(updates.status); }
    if (updates.ip_address !== undefined) { fields.push('ip_address = ?'); values.push(updates.ip_address); }
    if (updates.cpu !== undefined) { fields.push('cpu = ?'); values.push(updates.cpu); }
    if (updates.ram_mb !== undefined) { fields.push('ram_mb = ?'); values.push(updates.ram_mb); }
    if (updates.disk_gb !== undefined) { fields.push('disk_gb = ?'); values.push(updates.disk_gb); }
    if (updates.ssh_port !== undefined) { fields.push('ssh_port = ?'); values.push(updates.ssh_port); }
    fields.push('updated_at = ?');
    values.push(new Date().toISOString());
    values.push(id);
    const res = db.prepare(`UPDATE vms SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    return res.changes > 0;
  },

  deleteVm: (id: string, userId?: string): boolean => {
    if (userId) {
      const res = db.prepare('DELETE FROM vms WHERE id = ? AND user_id = ?').run(id, userId);
      return res.changes > 0;
    }
    const res = db.prepare('DELETE FROM vms WHERE id = ?').run(id);
    return res.changes > 0;
  },

  getNextAvailableSshPort: (): number => {
    const maxRow = db.prepare('SELECT MAX(ssh_port) as max_port FROM vms').get() as { max_port: number | null };
    const maxPort = maxRow.max_port || 2200;
    return Math.max(maxPort + 1, 2201);
  },

  // AutoDeploy Subsystem
  getAutoDeploySettings: (): AutoDeploySettings => {
    const enabled = Database.getSetting('autodeploy_enabled', 'true') === 'true';
    const totalSlots = parseInt(Database.getSetting('total_slots', '20'), 10);
    const defaultCpu = parseInt(Database.getSetting('slot_default_cpu', '2'), 10);
    const defaultRamMb = parseInt(Database.getSetting('slot_default_ram_mb', '2048'), 10);
    const defaultDiskGb = parseInt(Database.getSetting('slot_default_disk_gb', '20'), 10);
    let allowedTemplates: string[] = ['ubuntu:24.04', 'ubuntu:22.04', 'debian:12', 'alpine:3.20', 'rockylinux:9', 'almalinux:9'];
    try {
      const raw = Database.getSetting('allowed_templates', '');
      if (raw) allowedTemplates = JSON.parse(raw);
    } catch {}

    const occupiedSlots = (db.prepare('SELECT COUNT(*) as count FROM vms').get() as { count: number }).count;
    const availableSlots = Math.max(0, totalSlots - occupiedSlots);

    return {
      autodeploy_enabled: enabled,
      total_slots: totalSlots,
      occupied_slots: occupiedSlots,
      available_slots: availableSlots,
      slot_default_cpu: defaultCpu,
      slot_default_ram_mb: defaultRamMb,
      slot_default_disk_gb: defaultDiskGb,
      allowed_templates: allowedTemplates
    };
  },

  updateAutoDeploySettings: (updates: Partial<{
    autodeploy_enabled: boolean;
    total_slots: number;
    slot_default_cpu: number;
    slot_default_ram_mb: number;
    slot_default_disk_gb: number;
    allowed_templates: string[];
  }>) => {
    if (typeof updates.autodeploy_enabled === 'boolean') {
      Database.updateSetting('autodeploy_enabled', updates.autodeploy_enabled ? 'true' : 'false');
    }
    if (typeof updates.total_slots === 'number') {
      Database.updateSetting('total_slots', updates.total_slots.toString());
    }
    if (typeof updates.slot_default_cpu === 'number') {
      Database.updateSetting('slot_default_cpu', updates.slot_default_cpu.toString());
    }
    if (typeof updates.slot_default_ram_mb === 'number') {
      Database.updateSetting('slot_default_ram_mb', updates.slot_default_ram_mb.toString());
    }
    if (typeof updates.slot_default_disk_gb === 'number') {
      Database.updateSetting('slot_default_disk_gb', updates.slot_default_disk_gb.toString());
    }
    if (Array.isArray(updates.allowed_templates)) {
      Database.updateSetting('allowed_templates', JSON.stringify(updates.allowed_templates));
    }
  },

  canUserDeploy: (userId: string): { allowed: boolean; reason?: string } => {
    const user = Database.getUserById(userId);
    if (!user) return { allowed: false, reason: 'User account not found' };
    if (user.status === 'suspended') return { allowed: false, reason: 'Your account has been suspended by an administrator' };
    if (user.role === 'admin') return { allowed: true };

    // 1. Check if user already owns 1 VPS instance (Strict 1 VPS per user policy)
    const userVmCount = (db.prepare('SELECT COUNT(*) as count FROM vms WHERE user_id = ?').get(userId) as { count: number }).count;
    if (userVmCount >= 1) {
      return {
        allowed: false,
        reason: 'Each user is limited to a maximum of 1 VPS instance. You already have an active VPS deployed. Contact an administrator if you need to remove or reassign it.'
      };
    }

    // 2. Check if AutoDeploy is enabled globally
    const autodeploy = Database.getAutoDeploySettings();
    if (!autodeploy.autodeploy_enabled) {
      return { allowed: false, reason: 'AutoDeploy is currently disabled. Please contact an administrator to deploy your instance.' };
    }

    // 3. Check if overall node slots are exhausted
    if (autodeploy.available_slots <= 0) {
      return { allowed: false, reason: 'All node VPS deployment slots are currently exhausted. Please contact an administrator.' };
    }

    // 4. Check if user has an assigned slot allocated by admin
    const assignedSlots = user.assigned_slots || 0;
    if (assignedSlots < 1) {
      return {
        allowed: false,
        reason: 'No VPS deployment slot assigned to your account. Please contact an administrator to allocate a slot.'
      };
    }

    return { allowed: true };
  },

  // Settings
  getSetting: (key: string, defaultValue = ''): string => {
    const row = db.prepare('SELECT value FROM api_settings WHERE key = ?').get(key) as { value: string } | undefined;
    return row ? row.value : defaultValue;
  },

  getAllSettings: (): Record<string, string> => {
    const rows = db.prepare('SELECT key, value FROM api_settings').all() as { key: string; value: string }[];
    const result: Record<string, string> = {};
    for (const row of rows) {
      result[row.key] = row.value;
    }
    return result;
  },

  updateSetting: (key: string, value: string) => {
    db.prepare(`
      INSERT INTO api_settings (key, value)
      VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `).run(key, value);
  }
};
