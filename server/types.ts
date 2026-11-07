export type ApiPermission =
  | 'vms.read'
  | 'vms.create'
  | 'vms.start'
  | 'vms.stop'
  | 'vms.restart'
  | 'vms.delete'
  | 'images.read'
  | 'usage.read'
  | 'api.keys.read'
  | 'api.keys.manage';

export const ALL_PERMISSIONS: { id: ApiPermission; label: string; category: string; description: string }[] = [
  { id: 'vms.read', label: 'Read Virtual Machines', category: 'Virtual Machines', description: 'View virtual machine lists, hardware specs, state, and IP addresses' },
  { id: 'vms.create', label: 'Create Virtual Machines', category: 'Virtual Machines', description: 'Provision new Docker-based virtual machines with custom resources' },
  { id: 'vms.start', label: 'Start Virtual Machines', category: 'Virtual Machines', description: 'Power on stopped virtual machine instances' },
  { id: 'vms.stop', label: 'Stop Virtual Machines', category: 'Virtual Machines', description: 'Send graceful ACPI/SIGTERM shutdown to virtual machine instances' },
  { id: 'vms.restart', label: 'Restart Virtual Machines', category: 'Virtual Machines', description: 'Perform soft and hard reboots of virtual machine instances' },
  { id: 'vms.delete', label: 'Delete Virtual Machines', category: 'Virtual Machines', description: 'Permanently destroy virtual machines and associated root disks' },
  { id: 'images.read', label: 'Read OS Images', category: 'Image Templates', description: 'List available base OS images (Ubuntu, Debian, Alpine, Rocky, Alma)' },
  { id: 'usage.read', label: 'Read API Usage', category: 'Telemetry & Usage', description: 'Query rate limits, request counts, and quota statistics' },
  { id: 'api.keys.read', label: 'Read API Keys', category: 'API Keys', description: 'View API key metadata, expiration dates, and prefixes' },
  { id: 'api.keys.manage', label: 'Manage API Keys', category: 'API Keys', description: 'Create, revoke, regenerate, and delete API keys' },
];

export interface User {
  id: string;
  username: string;
  email: string;
  role: 'admin' | 'user';
  created_at: string;
}

export interface ApiKeyRecord {
  id: string;
  user_id: string;
  name: string;
  key_prefix: string;
  key_hash: string;
  permissions: ApiPermission[];
  created_at: string;
  expires_at: string | null;
  last_used_at: string | null;
  is_revoked: number; // 0 or 1
  revoked_at: string | null;
  description: string;
}

export interface ApiLogRecord {
  id: string;
  api_key_id: string | null;
  key_prefix: string | null;
  user_id: string | null;
  endpoint: string;
  method: string;
  status_code: number;
  duration_ms: number;
  ip_address: string;
  error_code: string | null;
  timestamp: string;
}

export interface VirtualMachine {
  id: string;
  user_id: string;
  name: string;
  image: string;
  status: 'running' | 'stopped' | 'restarting' | 'error';
  cpu: number;
  ram_mb: number;
  disk_gb: number;
  ssh_port: number;
  ip_address: string;
  container_id: string | null;
  ports: { host: number; guest: number; protocol: 'tcp' | 'udp' }[];
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface AdminApiKeyRecord {
  id: number;
  key_prefix: string;
  key_hash: string;
  raw_key: string;
  status: 'active' | 'revoked';
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
}

export interface OsImage {
  id: string;
  name: string;
  tag: string;
  category: string;
  size_mb: number;
  description: string;
  recommended_ram_mb: number;
  recommended_cpu: number;
  verified: boolean;
  status: 'available' | 'verified_upstream' | 'unavailable';
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}
