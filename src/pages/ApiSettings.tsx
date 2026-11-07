import React, { useState, useEffect } from 'react';
import {
  Sliders,
  Shield,
  Save,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Zap,
  Bell,
  Globe
} from 'lucide-react';

export const ApiSettings: React.FC = () => {
  const [settings, setSettings] = useState<Record<string, string>>({
    rate_limit_per_minute: '120',
    sensitive_rate_limit_per_minute: '30',
    default_key_expiry_days: '90',
    require_ip_allowlist: 'false',
    allowed_ip_cidrs: '0.0.0.0/0',
    alert_on_rate_limit: 'true',
    webhook_alert_url: ''
  });
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/settings');
      const json = await res.json();
      if (res.ok && json.success) {
        setSettings(json.data);
      }
    } catch (err) {
      console.error('Failed to load settings:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setErrorMsg(null);
    setSaveSuccess(false);

    try {
      const res = await fetch('/api/v1/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || 'Failed to update settings');
      }
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error saving settings');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-4 lg:p-8 space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
          <span>API Security & Rate Limit Configuration</span>
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Configure global rate limits, token lifetime defaults, and automated defense mechanisms for BusterNodes API endpoints.
        </p>
      </div>

      {saveSuccess && (
        <div className="p-3.5 rounded-xl bg-emerald-950/60 border border-emerald-800/60 text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>API configuration settings saved and applied to active token buckets!</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-rose-950/60 border border-rose-800/60 text-rose-300 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Section 1: Rate Limiting Controls */}
        <div className="p-5 rounded-2xl bg-[#111219] border border-white/5 space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-white/5">
            <Zap className="w-4 h-4 text-rose-400" />
            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
              Token Bucket Rate Limiting
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Standard Endpoints Limit (req/min)
              </label>
              <input
                type="number"
                min={10}
                max={5000}
                value={settings.rate_limit_per_minute || '120'}
                onChange={(e) => setSettings({ ...settings, rate_limit_per_minute: e.target.value })}
                className="w-full px-3.5 py-2 bg-[#090A0F] border border-white/10 rounded-xl text-xs font-mono text-slate-200 focus:outline-none focus:border-rose-600"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Applies to standard queries (`/vms`, `/status`, `/images`, `/usage`).
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Sensitive Endpoints Limit (req/min)
              </label>
              <input
                type="number"
                min={5}
                max={500}
                value={settings.sensitive_rate_limit_per_minute || '30'}
                onChange={(e) => setSettings({ ...settings, sensitive_rate_limit_per_minute: e.target.value })}
                className="w-full px-3.5 py-2 bg-[#090A0F] border border-white/10 rounded-xl text-xs font-mono text-slate-200 focus:outline-none focus:border-rose-600"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Applies to destructive and resource-intensive actions (VM provisioning, deletion, API key generation).
              </p>
            </div>
          </div>
        </div>

        {/* Section 2: Key Expiry & Default Security */}
        <div className="p-5 rounded-2xl bg-[#111219] border border-white/5 space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-white/5">
            <Lock className="w-4 h-4 text-rose-400" />
            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
              Token Expiration Defaults
            </h3>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Default Key Lifetime (Days)
            </label>
            <input
              type="number"
              min={1}
              max={730}
              value={settings.default_key_expiry_days || '90'}
              onChange={(e) => setSettings({ ...settings, default_key_expiry_days: e.target.value })}
              className="w-full sm:w-60 px-3.5 py-2 bg-[#090A0F] border border-white/10 rounded-xl text-xs font-mono text-slate-200 focus:outline-none focus:border-rose-600"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Suggested expiration duration pre-selected during new API key generation.
            </p>
          </div>
        </div>

        {/* Section 3: Host Resource Allocation & Overcommit Policy */}
        <div className="p-5 rounded-2xl bg-[#111219] border border-white/5 space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-white/5">
            <Shield className="w-4 h-4 text-rose-400" />
            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
              Host Resource Overcommit Policy
            </h3>
          </div>

          <div className="flex items-start justify-between gap-4 p-3 bg-[#090A0F] border border-white/5 rounded-xl">
            <div>
              <div className="text-xs font-semibold text-slate-200">Allow CPU Resource Overcommit</div>
              <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                When enabled, administrators may provision virtual machines whose combined or individual vCPU allocations exceed physical host cores. When disabled, deployments are strictly bounded by real host CPU capacity.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSettings({
                ...settings,
                allow_resource_overcommit: settings.allow_resource_overcommit === 'true' ? 'false' : 'true'
              })}
              className={`px-3 py-1.5 rounded-xl text-xs font-mono font-semibold transition-colors shrink-0 ${
                settings.allow_resource_overcommit === 'true'
                  ? 'bg-rose-950 text-rose-200 border border-rose-800'
                  : 'bg-white/5 text-slate-400 border border-white/10'
              }`}
            >
              {settings.allow_resource_overcommit === 'true' ? 'Enabled' : 'Disabled'}
            </button>
          </div>
        </div>

        {/* Section 3: Webhook & Security Alerts */}
        <div className="p-5 rounded-2xl bg-[#111219] border border-white/5 space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-white/5">
            <Bell className="w-4 h-4 text-rose-400" />
            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
              Incident & Quota Webhooks
            </h3>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Alert Webhook URL (Slack / Discord / Custom Endpoint)
            </label>
            <input
              type="url"
              placeholder="https://hooks.slack.com/services/..."
              value={settings.webhook_alert_url || ''}
              onChange={(e) => setSettings({ ...settings, webhook_alert_url: e.target.value })}
              className="w-full px-3.5 py-2 bg-[#090A0F] border border-white/10 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-rose-600"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Transmits real-time POST payloads whenever an API key experiences repeated rate limit rejections or unauthorized deletion attempts.
            </p>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex items-center justify-end pt-2">
          <button
            type="submit"
            disabled={isSaving}
            className="px-6 py-2.5 text-xs font-semibold text-white bg-gradient-to-r from-rose-800 to-rose-700 hover:from-rose-700 hover:to-rose-600 rounded-xl transition-all shadow-lg shadow-rose-950/40 flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? 'Applying Settings...' : 'Save API Configuration'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
