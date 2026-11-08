export type UserRole = 'admin' | 'user';

export interface UserItem {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  status: 'active' | 'suspended';
  must_change_password: boolean;
  assigned_slots: number;
  vms_count?: number;
  created_at?: string;
}

export interface AutoDeploySettings {
  autodeploy_enabled: boolean;
  total_slots: number;
  slot_default_cpu: number;
  slot_default_ram_mb: number;
  slot_default_disk_gb: number;
  allowed_templates: string[];
  deployment_limits?: {
    max_slots_per_user?: number;
    allow_custom_specs?: boolean;
  };
}

export interface UserDeployStatus {
  allowed: boolean;
  reason?: string;
  assigned_slots?: number;
  deployed_vms?: number;
  available_slots?: number;
}

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

export interface ApiKeyItem {
  id: string;
  user_id: string;
  name: string;
  key_prefix: string;
  permissions: ApiPermission[];
  created_at: string;
  expires_at: string | null;
  last_used_at: string | null;
  is_revoked: number;
  revoked_at: string | null;
  description: string;
}

export interface ApiLogItem {
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

export interface VirtualMachineItem {
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

export interface AdminApiKeyInfo {
  status: 'active' | 'revoked';
  key_prefix: string;
  raw_key: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
}

export interface OsImageItem {
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

export interface OverviewData {
  keys: {
    total: number;
    active: number;
    revoked: number;
  };
  requests: {
    total: number;
    today: number;
    failed: number;
    requestsPerMinute: number;
  };
  topEndpoints: {
    endpoint: string;
    method: string;
    count: number;
    avg_duration: number;
  }[];
  hourlyBreakdown: {
    hour_label: string;
    total_requests: number;
    failed_requests: number;
  }[];
  recentActivity: ApiLogItem[];
}

export interface SystemStatusData {
  panel: {
    name: string;
    brand: string;
    developer: string;
    version: string;
    status: string;
    uptime_seconds: number;
    timestamp: string;
  };
  host: {
    platform: string;
    arch: string;
    hostname: string;
    cpus: number;
    total_memory_mb: number;
    free_memory_mb: number;
    load_average: number[];
  };
  docker: {
    available: boolean;
    version: string | null;
    socket_detected: boolean;
    active_containers: number;
    mode: 'LIVE_DOCKER_ENGINE' | 'MANAGED_CONTAINER_STATE';
    diagnostics: string;
  };
  resources?: HostResourceInfo;
}

export interface HostResourceInfo {
  cpu: {
    cores: number;
    model: string;
    speedMhz: number;
    allocatedCores: number;
    runningAllocatedCores: number;
    availableCores: number;
  };
  ram: {
    totalMb: number;
    freeMb: number;
    usedMb: number;
    allocatedMb: number;
    runningAllocatedMb: number;
    availableMb: number;
  };
  disk: {
    totalGb: number;
    freeGb: number;
    usedGb: number;
    allocatedGb: number;
    availableGb: number;
    mountPoint: string;
  };
  environment: {
    virtualization: string;
    isContainer: boolean;
    platform: string;
    arch: string;
    release: string;
    hostname: string;
    uptimeSeconds: number;
  };
  vmCounts: {
    total: number;
    running: number;
    stopped: number;
    restarting: number;
  };
}
