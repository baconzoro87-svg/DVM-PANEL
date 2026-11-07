import React, { useState } from 'react';
import { X, Key, ShieldCheck, CheckSquare, Square, Info } from 'lucide-react';
import type { ApiPermission } from '../types/index.ts';

interface CreateKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onKeyCreated: (result: { rawKey: string; keyName: string }) => void;
}

const PERMISSION_GROUPS = [
  {
    group: 'Virtual Machines',
    permissions: [
      { id: 'vms.read' as ApiPermission, label: 'vms.read', desc: 'Query virtual machine status, specs, IP addresses' },
      { id: 'vms.create' as ApiPermission, label: 'vms.create', desc: 'Deploy new containerized virtual machines' },
      { id: 'vms.start' as ApiPermission, label: 'vms.start', desc: 'Power on stopped virtual machine instances' },
      { id: 'vms.stop' as ApiPermission, label: 'vms.stop', desc: 'Gracefully stop running virtual machines' },
      { id: 'vms.restart' as ApiPermission, label: 'vms.restart', desc: 'Reboot and restart virtual machine instances' },
      { id: 'vms.delete' as ApiPermission, label: 'vms.delete', desc: 'Permanently destroy virtual machines and storage' },
    ]
  },
  {
    group: 'Images & Templates',
    permissions: [
      { id: 'images.read' as ApiPermission, label: 'images.read', desc: 'List OS container images (Ubuntu, Debian, Alpine, Rocky, Alma)' },
    ]
  },
  {
    group: 'Telemetry & Usage',
    permissions: [
      { id: 'usage.read' as ApiPermission, label: 'usage.read', desc: 'Inspect request consumption, rate limits, and quota' },
    ]
  },
  {
    group: 'Key Administration',
    permissions: [
      { id: 'api.keys.read' as ApiPermission, label: 'api.keys.read', desc: 'View API key metadata, timestamps, and active prefixes' },
      { id: 'api.keys.manage' as ApiPermission, label: 'api.keys.manage', desc: 'Create, revoke, regenerate, and delete API keys' },
    ]
  }
];

const ALL_PERMS: ApiPermission[] = [
  'vms.read', 'vms.create', 'vms.start', 'vms.stop', 'vms.restart', 'vms.delete',
  'images.read', 'usage.read', 'api.keys.read', 'api.keys.manage'
];

export const CreateKeyModal: React.FC<CreateKeyModalProps> = ({
  isOpen,
  onClose,
  onKeyCreated,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedPermissions, setSelectedPermissions] = useState<ApiPermission[]>([
    'vms.read', 'vms.start', 'vms.stop', 'vms.restart', 'images.read', 'usage.read'
  ]);
  const [expiryDays, setExpiryDays] = useState<number | null>(90);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const togglePermission = (perm: ApiPermission) => {
    setSelectedPermissions(prev =>
      prev.includes(perm) ? prev.filter(p => p !== perm) : [...prev, perm]
    );
  };

  const applyPreset = (preset: 'all' | 'readonly' | 'operator') => {
    if (preset === 'all') {
      setSelectedPermissions([...ALL_PERMS]);
    } else if (preset === 'readonly') {
      setSelectedPermissions(['vms.read', 'images.read', 'usage.read', 'api.keys.read']);
    } else if (preset === 'operator') {
      setSelectedPermissions(['vms.read', 'vms.create', 'vms.start', 'vms.stop', 'vms.restart', 'images.read', 'usage.read']);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg('Key name is required');
      return;
    }
    if (selectedPermissions.length === 0) {
      setErrorMsg('Please select at least one permission');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/v1/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          permissions: selectedPermissions,
          expires_in_days: expiryDays,
          description: description.trim()
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || 'Failed to create API key');
      }

      onKeyCreated({
        rawKey: data.data.raw_key,
        keyName: data.data.name
      });
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error occurred while creating key');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-[#111219] border border-rose-950/70 rounded-2xl shadow-2xl p-6 text-slate-100 my-8">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-slate-400 hover:text-slate-200 p-1 rounded-lg hover:bg-white/5 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-rose-950 to-rose-900 border border-rose-800/40 text-rose-300">
            <Key className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-100">Create New API Key</h3>
            <p className="text-xs text-slate-400">Generate a cryptographically hashed token with granular scope</p>
          </div>
        </div>

        {errorMsg && (
          <div className="mb-4 p-3 rounded-xl bg-rose-950/50 border border-rose-800/60 text-xs text-rose-300 flex items-center gap-2">
            <Info className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Key Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. CI/CD Automated Deployer, Prometheus Exporter"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-[#090A0F] border border-white/10 rounded-xl text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-rose-600 transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Description <span className="text-slate-500 font-normal lowercase">(optional)</span>
            </label>
            <input
              type="text"
              placeholder="Purpose or associated application"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-[#090A0F] border border-white/10 rounded-xl text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-rose-600 transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Expiration Period
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { label: '30 Days', val: 30 },
                { label: '90 Days (Default)', val: 90 },
                { label: '1 Year', val: 365 },
                { label: 'Never Expires', val: null },
              ].map(opt => (
                <button
                  type="button"
                  key={opt.label}
                  onClick={() => setExpiryDays(opt.val)}
                  className={`py-2 px-3 text-xs font-medium rounded-xl border text-center transition-all ${
                    expiryDays === opt.val
                      ? 'bg-rose-950/70 border-rose-600 text-rose-200'
                      : 'bg-[#090A0F] border-white/5 text-slate-400 hover:text-slate-200 hover:border-white/10'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Granular Permissions Section */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-rose-400" />
                Granular Permissions ({selectedPermissions.length} selected)
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => applyPreset('readonly')}
                  className="text-[11px] text-slate-400 hover:text-rose-300 underline"
                >
                  Read-Only
                </button>
                <span className="text-slate-600 text-xs">·</span>
                <button
                  type="button"
                  onClick={() => applyPreset('operator')}
                  className="text-[11px] text-slate-400 hover:text-rose-300 underline"
                >
                  VM Operator
                </button>
                <span className="text-slate-600 text-xs">·</span>
                <button
                  type="button"
                  onClick={() => applyPreset('all')}
                  className="text-[11px] text-slate-400 hover:text-rose-300 underline"
                >
                  Select All
                </button>
              </div>
            </div>

            <div className="max-h-60 overflow-y-auto p-3 bg-[#090A0F] border border-white/10 rounded-xl space-y-4">
              {PERMISSION_GROUPS.map(group => (
                <div key={group.group}>
                  <div className="text-[11px] font-bold text-rose-400/90 uppercase tracking-wider mb-2">
                    {group.group}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {group.permissions.map(perm => {
                      const isChecked = selectedPermissions.includes(perm.id);
                      return (
                        <div
                          key={perm.id}
                          onClick={() => togglePermission(perm.id)}
                          className={`p-2.5 rounded-lg border cursor-pointer transition-all flex items-start gap-2.5 ${
                            isChecked
                              ? 'bg-rose-950/40 border-rose-800/60 text-slate-100'
                              : 'bg-white/[0.02] border-white/5 text-slate-400 hover:border-white/10'
                          }`}
                        >
                          <div className="mt-0.5 shrink-0 text-rose-400">
                            {isChecked ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4 text-slate-600" />}
                          </div>
                          <div>
                            <div className="font-mono text-xs font-semibold text-rose-200">{perm.label}</div>
                            <div className="text-[11px] text-slate-400 leading-tight mt-0.5">{perm.desc}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-slate-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 text-sm font-semibold text-white bg-gradient-to-r from-rose-800 to-rose-700 hover:from-rose-700 hover:to-rose-600 rounded-xl transition-all shadow-lg shadow-rose-950/40"
            >
              {isSubmitting ? 'Generating...' : 'Generate API Key'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
