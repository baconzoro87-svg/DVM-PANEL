import React, { useState, useEffect } from 'react';
import {
  Zap,
  Sliders,
  CheckCircle,
  AlertTriangle,
  Server,
  Layers,
  Cpu,
  HardDrive,
  Save,
  RefreshCw,
  Info
} from 'lucide-react';
import type { AutoDeploySettings as SettingsType } from '../types/index.ts';

export const AutoDeploySettings: React.FC = () => {
  const [settings, setSettings] = useState<SettingsType | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form states
  const [enabled, setEnabled] = useState(true);
  const [totalSlots, setTotalSlots] = useState(20);
  const [defaultCpu, setDefaultCpu] = useState(2);
  const [defaultRamMb, setDefaultRamMb] = useState(2048);
  const [defaultDiskGb, setDefaultDiskGb] = useState(20);
  const [allowedTemplates, setAllowedTemplates] = useState<string[]>([
    'ubuntu:24.04',
    'ubuntu:22.04',
    'debian:12',
    'alpine:3.20'
  ]);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('dvm_token');
      const res = await fetch('/api/v1/autodeploy', {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      const data = await res.json();
      if (res.ok && data.success) {
        const s: SettingsType = data.data.settings;
        setSettings(s);
        setEnabled(s.autodeploy_enabled);
        setTotalSlots(s.total_slots);
        setDefaultCpu(s.slot_default_cpu);
        setDefaultRamMb(s.slot_default_ram_mb);
        setDefaultDiskGb(s.slot_default_disk_gb);
        setAllowedTemplates(s.allowed_templates || []);
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: 'Failed to load AutoDeploy settings' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const token = localStorage.getItem('dvm_token');
      const res = await fetch('/api/v1/autodeploy', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          autodeploy_enabled: enabled,
          total_slots: Number(totalSlots),
          slot_default_cpu: Number(defaultCpu),
          slot_default_ram_mb: Number(defaultRamMb),
          slot_default_disk_gb: Number(defaultDiskGb),
          allowed_templates: allowedTemplates
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || 'Failed to update AutoDeploy settings');
      }

      setSettings(data.data);
      setMessage({ type: 'success', text: 'AutoDeploy settings and slot allocations saved successfully' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Save failed' });
    } finally {
      setSaving(false);
    }
  };

  const toggleTemplate = (tag: string) => {
    if (allowedTemplates.includes(tag)) {
      if (allowedTemplates.length === 1) return; // keep at least one
      setAllowedTemplates(allowedTemplates.filter(t => t !== tag));
    } else {
      setAllowedTemplates([...allowedTemplates, tag]);
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-slate-400">
        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-rose-400" />
        <p className="text-xs">Loading AutoDeploy configuration...</p>
      </div>
    );
  }

  const allAvailableTemplates = [
    { tag: 'ubuntu:24.04', name: 'Ubuntu 24.04 LTS (Noble Numbat)' },
    { tag: 'ubuntu:22.04', name: 'Ubuntu 22.04 LTS (Jammy Jellyfish)' },
    { tag: 'debian:12', name: 'Debian 12 Bookworm' },
    { tag: 'alpine:3.20', name: 'Alpine Linux 3.20 (Minimal)' },
    { tag: 'rockylinux:9', name: 'Rocky Linux 9 (Enterprise)' },
    { tag: 'almalinux:9', name: 'AlmaLinux 9 (Binary RHEL)' }
  ];

  return (
    <div className="p-4 lg:p-8 max-w-5xl mx-auto space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-950/60 border border-rose-800/50 text-rose-300 text-xs font-mono uppercase mb-2">
            <Zap className="w-3.5 h-3.5 text-rose-400" />
            <span>Administrator Control</span>
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight">AutoDeploy & Provisioning Policy</h2>
          <p className="text-xs text-slate-400 mt-1">
            Configure automated slot quotas, hardware limits, and container templates for BusterNodes users.
          </p>
        </div>

        <button
          onClick={fetchSettings}
          className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors self-start sm:self-auto cursor-pointer"
          title="Reload settings"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {message && (
        <div
          className={`p-4 rounded-xl border flex items-center gap-3 text-xs ${
            message.type === 'success'
              ? 'bg-emerald-950/60 border-emerald-800/60 text-emerald-200'
              : 'bg-rose-950/60 border-rose-800/60 text-rose-200'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Toggle Master AutoDeploy Card */}
        <div className="p-6 rounded-2xl bg-[#0F111A] border border-rose-950/80 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <h3 className="text-base font-bold text-white">AutoDeploy System Status</h3>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono uppercase font-bold tracking-wider ${
                  enabled
                    ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/60'
                    : 'bg-rose-950/80 text-rose-300 border border-rose-800/60'
                }`}
              >
                {enabled ? 'Active / Enabled' : 'Disabled / Suspended'}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1 max-w-xl">
              When enabled, users with assigned available slots can provision container instances up to the allocated quota. If disabled, all non-admin deployments are rejected.
            </p>
          </div>

          <label className="relative inline-flex items-center cursor-pointer shrink-0">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-13 h-7 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-rose-600"></div>
          </label>
        </div>

        {/* Quotas & Hardware Specs */}
        <div className="p-6 rounded-2xl bg-[#0F111A] border border-rose-950/80 shadow-xl space-y-5">
          <div className="flex items-center gap-2.5 pb-4 border-b border-rose-950/60">
            <Sliders className="w-4 h-4 text-rose-400" />
            <h3 className="text-sm font-bold text-white">Global Slot Quota & Default Instance Sizing</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center justify-between">
                <span>Total Fleet Slots</span>
                <span className="text-[10px] text-slate-500 font-mono">1–500</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="1"
                  max="500"
                  required
                  value={totalSlots}
                  onChange={(e) => setTotalSlots(parseInt(e.target.value, 10) || 1)}
                  className="w-full px-3.5 py-2.5 bg-[#07080C] border border-slate-800 rounded-xl text-sm font-mono text-white focus:outline-none focus:border-rose-500"
                />
              </div>
              <p className="text-[11px] text-slate-500 mt-1">Maximum containers hosted across node</p>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center justify-between">
                <span>Default vCPU Cores</span>
                <span className="text-[10px] text-slate-500 font-mono">Cores</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="1"
                  max="64"
                  required
                  value={defaultCpu}
                  onChange={(e) => setDefaultCpu(parseInt(e.target.value, 10) || 1)}
                  className="w-full px-3.5 py-2.5 bg-[#07080C] border border-slate-800 rounded-xl text-sm font-mono text-white focus:outline-none focus:border-rose-500"
                />
              </div>
              <p className="text-[11px] text-slate-500 mt-1">Default cores allocated per slot</p>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center justify-between">
                <span>Default RAM (MB)</span>
                <span className="text-[10px] text-slate-500 font-mono">MB</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="128"
                  max="131072"
                  step="128"
                  required
                  value={defaultRamMb}
                  onChange={(e) => setDefaultRamMb(parseInt(e.target.value, 10) || 512)}
                  className="w-full px-3.5 py-2.5 bg-[#07080C] border border-slate-800 rounded-xl text-sm font-mono text-white focus:outline-none focus:border-rose-500"
                />
              </div>
              <p className="text-[11px] text-slate-500 mt-1">Default RAM (e.g. 2048 MB = 2 GB)</p>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center justify-between">
                <span>Default SSD Disk (GB)</span>
                <span className="text-[10px] text-slate-500 font-mono">GB</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="1"
                  max="2000"
                  required
                  value={defaultDiskGb}
                  onChange={(e) => setDefaultDiskGb(parseInt(e.target.value, 10) || 10)}
                  className="w-full px-3.5 py-2.5 bg-[#07080C] border border-slate-800 rounded-xl text-sm font-mono text-white focus:outline-none focus:border-rose-500"
                />
              </div>
              <p className="text-[11px] text-slate-500 mt-1">Default root storage volume</p>
            </div>
          </div>
        </div>

        {/* Supported Images Policy */}
        <div className="p-6 rounded-2xl bg-[#0F111A] border border-rose-950/80 shadow-xl space-y-4">
          <div className="flex items-center gap-2.5 pb-4 border-b border-rose-950/60">
            <Layers className="w-4 h-4 text-rose-400" />
            <h3 className="text-sm font-bold text-white">Permitted Operating System Images</h3>
          </div>

          <p className="text-xs text-slate-400">
            Select the Linux distribution images that standard users are allowed to select when deploying their VPS instances.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {allAvailableTemplates.map((img) => {
              const isSelected = allowedTemplates.includes(img.tag);
              return (
                <button
                  key={img.tag}
                  type="button"
                  onClick={() => toggleTemplate(img.tag)}
                  className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                    isSelected
                      ? 'bg-rose-950/40 border-rose-600/60 text-white shadow-sm'
                      : 'bg-[#07080C] border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div>
                    <div className="text-xs font-bold text-white">{img.name}</div>
                    <div className="text-[11px] font-mono text-slate-500 mt-0.5">{img.tag}</div>
                  </div>
                  <div
                    className={`w-5 h-5 rounded-md flex items-center justify-center border text-[11px] font-bold ${
                      isSelected
                        ? 'bg-rose-600 border-rose-500 text-white'
                        : 'border-slate-700 text-transparent'
                    }`}
                  >
                    ✓
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Save Bar */}
        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Info className="w-4 h-4 text-slate-400" />
            <span>Changes take effect immediately on all subsequent deployment requests</span>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-rose-600 to-pink-700 hover:from-rose-500 hover:to-pink-600 shadow-lg shadow-rose-950/50 flex items-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
          >
            {saving ? (
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Save AutoDeploy Configuration</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
