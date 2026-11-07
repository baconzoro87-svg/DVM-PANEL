import React, { useState } from 'react';
import { ShieldCheck, Lock, CheckCircle2, AlertTriangle, Key, Terminal, Code2 } from 'lucide-react';
import type { ApiPermission } from '../types/index.ts';

interface PermissionDetail {
  id: ApiPermission;
  name: string;
  category: 'Virtual Machines' | 'OS Images' | 'Telemetry & Usage' | 'Administration';
  description: string;
  endpoints: { method: string; path: string }[];
  riskLevel: 'Low' | 'Medium' | 'High' | 'Critical';
}

const PERMISSIONS_LIST: PermissionDetail[] = [
  {
    id: 'vms.read',
    name: 'Read Virtual Machines',
    category: 'Virtual Machines',
    description: 'Allows querying the fleet of virtual machines, inspect hardware resource allocations, private IP addresses, and live status.',
    endpoints: [
      { method: 'GET', path: '/api/v1/vms' },
      { method: 'GET', path: '/api/v1/vms/:id' }
    ],
    riskLevel: 'Low'
  },
  {
    id: 'vms.create',
    name: 'Create Virtual Machines',
    category: 'Virtual Machines',
    description: 'Allows provisioning new Docker container virtual machines with custom vCPU, memory, disk, and SSH port forwarding.',
    endpoints: [
      { method: 'POST', path: '/api/v1/vms' }
    ],
    riskLevel: 'High'
  },
  {
    id: 'vms.start',
    name: 'Start Virtual Machines',
    category: 'Virtual Machines',
    description: 'Allows powering on stopped container virtual machines.',
    endpoints: [
      { method: 'POST', path: '/api/v1/vms/:id/start' }
    ],
    riskLevel: 'Medium'
  },
  {
    id: 'vms.stop',
    name: 'Stop Virtual Machines',
    category: 'Virtual Machines',
    description: 'Allows issuing graceful ACPI / SIGTERM shutdown commands to running virtual machines.',
    endpoints: [
      { method: 'POST', path: '/api/v1/vms/:id/stop' }
    ],
    riskLevel: 'Medium'
  },
  {
    id: 'vms.restart',
    name: 'Restart Virtual Machines',
    category: 'Virtual Machines',
    description: 'Allows triggering soft or hard reboots of virtual machines.',
    endpoints: [
      { method: 'POST', path: '/api/v1/vms/:id/restart' }
    ],
    riskLevel: 'Medium'
  },
  {
    id: 'vms.delete',
    name: 'Delete Virtual Machines',
    category: 'Virtual Machines',
    description: 'Allows permanently destroying container instances and unmounting their root storage. Protected by sensitive rate limiters.',
    endpoints: [
      { method: 'DELETE', path: '/api/v1/vms/:id' }
    ],
    riskLevel: 'Critical'
  },
  {
    id: 'images.read',
    name: 'Read OS Templates',
    category: 'OS Images',
    description: 'Allows retrieving the catalog of certified operating system templates (Ubuntu, Debian, Alpine, Rocky, Alma).',
    endpoints: [
      { method: 'GET', path: '/api/v1/images' }
    ],
    riskLevel: 'Low'
  },
  {
    id: 'usage.read',
    name: 'Read API Usage & Quotas',
    category: 'Telemetry & Usage',
    description: 'Allows inspecting real-time rate limit consumption, quota consumption, and request metrics.',
    endpoints: [
      { method: 'GET', path: '/api/v1/usage' }
    ],
    riskLevel: 'Low'
  },
  {
    id: 'api.keys.read',
    name: 'Read API Keys & Logs',
    category: 'Administration',
    description: 'Allows listing API key metadata, timestamps, and querying activity logs without accessing raw hashed secrets.',
    endpoints: [
      { method: 'GET', path: '/api/v1/api-keys' },
      { method: 'GET', path: '/api/v1/logs' }
    ],
    riskLevel: 'Medium'
  },
  {
    id: 'api.keys.manage',
    name: 'Manage API Credentials',
    category: 'Administration',
    description: 'Full administrative credential management: allows generating new API keys, revoking compromised keys, and regenerating secrets.',
    endpoints: [
      { method: 'POST', path: '/api/v1/api-keys' },
      { method: 'DELETE', path: '/api/v1/api-keys/:id' },
      { method: 'POST', path: '/api/v1/api-keys/:id/revoke' },
      { method: 'POST', path: '/api/v1/api-keys/:id/regenerate' }
    ],
    riskLevel: 'Critical'
  }
];

export const ApiPermissions: React.FC = () => {
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [selectedPermission, setSelectedPermission] = useState<PermissionDetail>(PERMISSIONS_LIST[0]);

  const categories = ['all', 'Virtual Machines', 'OS Images', 'Telemetry & Usage', 'Administration'];

  const filtered = activeCategory === 'all'
    ? PERMISSIONS_LIST
    : PERMISSIONS_LIST.filter(p => p.category === activeCategory);

  return (
    <div className="p-4 lg:p-8 space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
          <span>Granular Role-Based Access Control (RBAC)</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-rose-950 text-rose-300 border border-rose-900/50 font-mono">
            {PERMISSIONS_LIST.length} Granular Scopes
          </span>
        </h2>
        <p className="text-xs text-slate-400 mt-1 max-w-3xl">
          BusterNodes enforces fine-grained permission verification on every REST API route. Tokens must explicitly carry the requisite permission scope; unassigned operations are rejected with HTTP 403 Forbidden.
        </p>
      </div>

      {/* Category filter pills */}
      <div className="flex flex-wrap items-center gap-2">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${
              activeCategory === cat
                ? 'bg-rose-950 text-rose-200 border border-rose-900/60 shadow-sm'
                : 'bg-[#111219] text-slate-400 hover:text-slate-200 border border-white/5'
            }`}
          >
            {cat === 'all' ? 'All Permissions' : cat}
          </button>
        ))}
      </div>

      {/* Split Layout: Permission directory + Inspector Card */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Permission list */}
        <div className="lg:col-span-2 space-y-3">
          {filtered.map(p => {
            const isSelected = selectedPermission.id === p.id;
            return (
              <div
                key={p.id}
                onClick={() => setSelectedPermission(p)}
                className={`p-4 rounded-xl border transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-[#14080D] border-rose-700/80 shadow-lg shadow-rose-950/30'
                    : 'bg-[#111219] border-white/5 hover:border-rose-950/40'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-rose-300">{p.id}</span>
                      <span className="text-xs text-slate-300 font-semibold">({p.name})</span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">{p.description}</p>
                  </div>

                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded shrink-0 ${
                    p.riskLevel === 'Critical' ? 'bg-rose-950 text-rose-400 border border-rose-900/60' :
                    p.riskLevel === 'High' ? 'bg-amber-950 text-amber-400 border border-amber-900/60' :
                    p.riskLevel === 'Medium' ? 'bg-blue-950 text-blue-400 border border-blue-900/60' :
                    'bg-slate-900 text-slate-400 border border-slate-800'
                  }`}>
                    {p.riskLevel} Risk
                  </span>
                </div>

                <div className="mt-3 pt-3 border-t border-white/5 flex flex-wrap items-center gap-2">
                  <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Required For:</span>
                  {p.endpoints.map((ep, i) => (
                    <span key={i} className="text-[11px] font-mono px-2 py-0.5 rounded bg-[#090A0F] text-slate-300 border border-white/5">
                      <strong className="text-rose-400">{ep.method}</strong> {ep.path}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Right: Permission Detail & Enforcement Inspector */}
        <div className="p-5 rounded-2xl bg-[#111219] border border-white/5 space-y-5 h-fit sticky top-24">
          <div className="flex items-center gap-2.5 pb-4 border-b border-white/5">
            <div className="p-2.5 rounded-xl bg-rose-950 text-rose-300 border border-rose-900/50">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-rose-400">Permission Scope</div>
              <div className="font-mono font-bold text-sm text-slate-100">{selectedPermission.id}</div>
            </div>
          </div>

          <div>
            <div className="text-xs font-semibold text-slate-300 mb-1">Authorization Mechanics</div>
            <p className="text-xs text-slate-400 leading-relaxed">
              When an API client transmits a request to any bound endpoint, the middleware performs a constant-time cryptographic hash lookup of the bearer token, checks revocation and expiration, then verifies if <code className="text-rose-300 bg-black/40 px-1 py-0.5 rounded font-mono">{selectedPermission.id}</code> is present in the token&apos;s permissions payload.
            </p>
          </div>

          <div>
            <div className="text-xs font-semibold text-slate-300 mb-2">Simulated Error Response (403)</div>
            <div className="p-3 bg-[#090A0F] border border-rose-950/60 rounded-xl font-mono text-[11px] text-rose-300 overflow-x-auto leading-relaxed">
              <pre>{JSON.stringify({
  success: false,
  error: {
    code: "INSUFFICIENT_PERMISSIONS",
    message: `API key lacks the required permission: '${selectedPermission.id}'`,
    details: {
      requiredPermission: selectedPermission.id,
      assignedPermissions: ["images.read", "usage.read"]
    }
  }
}, null, 2)}</pre>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-1.5">
            <div className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-rose-400" />
              <span>Zero-Trust Architecture</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Even with administrative roles, external API keys cannot perform actions outside their explicitly provisioned permissions array.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
