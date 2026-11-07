import React, { useState, useEffect } from 'react';
import {
  KeyRound,
  ShieldAlert,
  ShieldCheck,
  Copy,
  Check,
  RefreshCw,
  AlertTriangle,
  Terminal,
  Code2,
  ExternalLink,
  Power,
  Server,
  Layers,
  Cpu,
  Eye,
  EyeOff,
  Activity
} from 'lucide-react';
import type { AdminApiKeyInfo, ApiLogItem } from '../types/index.ts';

export const ApiIntegration: React.FC = () => {
  const [apiKeyInfo, setApiKeyInfo] = useState<AdminApiKeyInfo | null>(null);
  const [logs, setLogs] = useState<ApiLogItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRevealed, setIsRevealed] = useState(false);
  const [hasCopied, setHasCopied] = useState(false);
  const [hasCopiedUrl, setHasCopiedUrl] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [isRevoking, setIsRevoking] = useState(false);
  const [activeSnippetTab, setActiveSnippetTab] = useState<'discord_js' | 'python_discord' | 'curl'>('discord_js');
  const [showRegenConfirm, setShowRegenConfirm] = useState(false);
  const [showRevokeConfirm, setShowRevokeConfirm] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const baseUrl = typeof window !== 'undefined' ? `${window.location.origin}/api/v1` : 'http://localhost:3000/api/v1';

  const fetchKeyData = async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/v1/admin/api-key');
      const data = await res.json();
      if (res.ok && data.success) {
        setApiKeyInfo(data.data);
      }
    } catch (err: any) {
      console.error('Failed to load admin API key:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchLogs = async () => {
    try {
      const res = await fetch('/api/v1/admin/api-logs');
      const data = await res.json();
      if (res.ok && data.success) {
        setLogs(data.data);
      }
    } catch (err) {
      console.error('Failed to load logs:', err);
    }
  };

  useEffect(() => {
    fetchKeyData();
    fetchLogs();
  }, []);

  const handleCopyKey = () => {
    if (!apiKeyInfo?.raw_key) return;
    navigator.clipboard.writeText(apiKeyInfo.raw_key);
    setHasCopied(true);
    setTimeout(() => setHasCopied(false), 2000);
  };

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(baseUrl);
    setHasCopiedUrl(true);
    setTimeout(() => setHasCopiedUrl(false), 2000);
  };

  const handleRegenerateKey = async () => {
    setIsRegenerating(true);
    setShowRegenConfirm(false);
    setFeedbackMsg(null);
    try {
      const res = await fetch('/api/v1/admin/api-key/generate', { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.success) {
        setApiKeyInfo(data.data);
        setIsRevealed(true);
        setFeedbackMsg({ type: 'success', text: 'New Admin API Key generated. Previous key invalidated.' });
        fetchLogs();
      } else {
        throw new Error(data.error?.message || 'Failed to regenerate key');
      }
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err.message });
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleToggleRevoke = async () => {
    setShowRevokeConfirm(false);
    setIsRevoking(true);
    setFeedbackMsg(null);
    const endpoint = apiKeyInfo?.status === 'active' ? '/api/v1/admin/api-key/revoke' : '/api/v1/admin/api-key/enable';
    try {
      const res = await fetch(endpoint, { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.success) {
        setApiKeyInfo(prev => prev ? { ...prev, status: data.data.status } : null);
        setFeedbackMsg({
          type: 'success',
          text: data.data.status === 'revoked'
            ? 'API key revoked. External bot and automation requests are now blocked.'
            : 'API key re-enabled. External bot and automation requests are allowed.'
        });
        fetchLogs();
      }
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err.message });
    } finally {
      setIsRevoking(false);
    }
  };

  const rawKeyText = apiKeyInfo?.raw_key || '';
  const maskedKeyText = rawKeyText.length > 16 
    ? `${rawKeyText.slice(0, 10)}${'•'.repeat(24)}${rawKeyText.slice(-6)}`
    : '••••••••••••••••••••••••';

  // Bot Code Snippets
  const discordJsSnippet = `// BusterNodes DVM Panel - Discord.js v14 Bot Integration
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const axios = require('axios');

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

// Configure BusterNodes DVM API client
const DVM_BASE_URL = '${baseUrl}';
const DVM_API_KEY = '${apiKeyInfo?.raw_key || 'YOUR_ADMIN_API_KEY'}';

const dvm = axios.create({
  baseURL: DVM_BASE_URL,
  headers: {
    'Authorization': \`Bearer \${DVM_API_KEY}\`,
    'Content-Type': 'application/json'
  }
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  // Command: !status - Check panel and host resources
  if (message.content === '!status') {
    try {
      const { data } = await dvm.get('/status');
      const host = data.data.host;
      const resInfo = data.data.resources;

      const embed = new EmbedBuilder()
        .setTitle('BusterNodes DVM Panel - Host Status')
        .setColor(0xBE123C)
        .addFields(
          { name: 'Host Platform', value: \`\${host.hostname} (\${host.platform} \${host.arch})\`, inline: true },
          { name: 'CPU Cores', value: \`\${resInfo?.cpu.cores || host.cpus} Cores\`, inline: true },
          { name: 'RAM Capacity', value: \`\${(host.total_memory_mb / 1024).toFixed(1)} GB\`, inline: true },
          { name: 'Docker Virtualization', value: data.data.docker.mode, inline: true }
        )
        .setFooter({ text: 'Made by Azmal · BusterNodes' });

      message.reply({ embeds: [embed] });
    } catch (err) {
      message.reply('❌ Failed to fetch DVM status: ' + (err.response?.data?.error?.message || err.message));
    }
  }

  // Command: !vms - List all active virtual machines
  if (message.content === '!vms') {
    try {
      const { data } = await dvm.get('/vms');
      const vms = data.data;

      if (vms.length === 0) {
        return message.reply('No virtual machines currently deployed.');
      }

      const list = vms.map(vm => 
        \`• **\${vm.name}** (\${vm.status.toUpperCase()}) - \${vm.cpu} vCPU, \${(vm.ram_mb/1024).toFixed(1)}GB RAM, \${vm.disk_gb}GB SSD | SSH Port: \${vm.ssh_port}\`
      ).join('\\n');

      message.reply(\`**Active Virtual Machines (\${vms.length}):**\\n\${list}\`);
    } catch (err) {
      message.reply('❌ Error querying VMs: ' + (err.response?.data?.error?.message || err.message));
    }
  }

  // Command: !deploy <name> <cores> <ram_gb> <disk_gb>
  if (message.content.startsWith('!deploy ')) {
    const [_, name, cores, ramGb, diskGb] = message.content.split(' ');
    if (!name) return message.reply('Usage: !deploy <name> <cores> <ram_gb> <disk_gb>');

    try {
      const { data } = await dvm.post('/vms', {
        name,
        image: 'ubuntu:24.04',
        cpu: parseInt(cores || '2', 10),
        ram_mb: Math.round(parseFloat(ramGb || '2') * 1024),
        disk_gb: parseInt(diskGb || '20', 10),
        notes: 'Provisioned via Discord Bot'
      });

      message.reply(\`✅ VM **\${data.data.name}** deployed successfully! SSH port: \${data.data.ssh_port}\`);
    } catch (err) {
      message.reply('❌ Deployment failed: ' + (err.response?.data?.error?.message || err.message));
    }
  }
});

client.login('YOUR_DISCORD_BOT_TOKEN');`;

  const pythonSnippet = `# BusterNodes DVM Panel - Python discord.py Bot Integration
import discord
from discord.ext import commands
import aiohttp

intents = discord.Intents.default()
intents.message_content = True
bot = commands.Bot(command_prefix='!', intents=intents)

DVM_BASE_URL = "${baseUrl}"
DVM_API_KEY = "${apiKeyInfo?.raw_key || 'YOUR_ADMIN_API_KEY'}"

HEADERS = {
    "Authorization": f"Bearer {DVM_API_KEY}",
    "Content-Type": "application/json"
}

@bot.command(name="status")
async def dvm_status(ctx):
    """Check BusterNodes DVM Panel and host virtualization capacity"""
    async with aiohttp.ClientSession() as session:
        async with session.get(f"{DVM_BASE_URL}/status", headers=HEADERS) as resp:
            if resp.status == 200:
                data = await resp.json()
                host = data['data']['host']
                res_info = data['data'].get('resources', {})
                embed = discord.Embed(title="BusterNodes DVM Status", color=0xBE123C)
                embed.add_field(name="Hostname", value=host['hostname'], inline=True)
                embed.add_field(name="Host CPU", value=f"{host['cpus']} Cores", inline=True)
                embed.add_field(name="Host RAM", value=f"{host['total_memory_mb'] // 1024} GB", inline=True)
                embed.set_footer(text="Made by Azmal · BusterNodes")
                await ctx.send(embed=embed)
            else:
                await ctx.send("❌ Error contacting DVM API")

@bot.command(name="vms")
async def list_vms(ctx):
    """List all deployed virtual machines"""
    async with aiohttp.ClientSession() as session:
        async with session.get(f"{DVM_BASE_URL}/vms", headers=HEADERS) as resp:
            if resp.status == 200:
                res = await resp.json()
                vms = res['data']
                if not vms:
                    await ctx.send("No virtual machines currently active.")
                    return
                lines = [f"• **{v['name']}** [{v['status']}] - {v['cpu']} vCPU | {v['ram_mb']}MB RAM | Port: {v['ssh_port']}" for v in vms]
                await ctx.send("\\n".join(lines))
            else:
                await ctx.send("❌ Failed to list VMs")

@bot.command(name="deploy")
async def deploy_vm(ctx, name: str, cpu: int = 2, ram_gb: int = 2, disk_gb: int = 20):
    """Deploy a VM with custom CPU, RAM, and SSD allocation"""
    payload = {
        "name": name,
        "image": "ubuntu:24.04",
        "cpu": cpu,
        "ram_mb": ram_gb * 1024,
        "disk_gb": disk_gb,
        "notes": "Created via Python Discord Bot"
    }
    async with aiohttp.ClientSession() as session:
        async with session.post(f"{DVM_BASE_URL}/vms", json=payload, headers=HEADERS) as resp:
            data = await resp.json()
            if resp.status == 201:
                vm = data['data']
                await ctx.send(f"✅ Created VM **{vm['name']}** on SSH port {vm['ssh_port']}")
            else:
                await ctx.send(f"❌ Creation failed: {data.get('error', {}).get('message', 'Unknown error')}")

bot.run("YOUR_DISCORD_BOT_TOKEN")`;

  const curlSnippet = `# 1. Check Panel & Host Virtualization Status
curl -X GET "${baseUrl}/status" \\
  -H "Authorization: Bearer ${apiKeyInfo?.raw_key || 'YOUR_ADMIN_API_KEY'}"

# 2. Get Real Host Capacity & Resource Availability
curl -X GET "${baseUrl}/resources" \\
  -H "Authorization: Bearer ${apiKeyInfo?.raw_key || 'YOUR_ADMIN_API_KEY'}"

# 3. List All Virtual Machines
curl -X GET "${baseUrl}/vms" \\
  -H "Authorization: Bearer ${apiKeyInfo?.raw_key || 'YOUR_ADMIN_API_KEY'}"

# 4. Deploy VM with Custom Resources (e.g. 4 Cores, 8 GB RAM, 100 GB SSD)
curl -X POST "${baseUrl}/vms" \\
  -H "Authorization: Bearer ${apiKeyInfo?.raw_key || 'YOUR_ADMIN_API_KEY'}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "edge-node-01",
    "image": "ubuntu:24.04",
    "cpu": 4,
    "ram_mb": 8192,
    "disk_gb": 100,
    "notes": "Automated provisioning"
  }'

# 5. Restart Virtual Machine
curl -X POST "${baseUrl}/vms/vm-7f3b8a1c/restart" \\
  -H "Authorization: Bearer ${apiKeyInfo?.raw_key || 'YOUR_ADMIN_API_KEY'}"

# 6. Stop Virtual Machine
curl -X POST "${baseUrl}/vms/vm-7f3b8a1c/stop" \\
  -H "Authorization: Bearer ${apiKeyInfo?.raw_key || 'YOUR_ADMIN_API_KEY'}"`;

  return (
    <div className="p-4 lg:p-8 space-y-8 max-w-7xl mx-auto">
      {/* Page Title & Scope */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] font-mono uppercase tracking-widest text-rose-400">Admin Settings</span>
            <span className="text-slate-600">/</span>
            <span className="text-[11px] font-mono text-slate-400">Integration</span>
          </div>
          <h2 className="text-2xl font-black text-slate-100 tracking-tight flex items-center gap-3">
            <span>API Integration</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-rose-950 text-rose-300 border border-rose-900/60 font-mono font-medium">
              Single Master Admin Key
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-1 max-w-3xl leading-relaxed">
            Configure the single global administrative API key for BusterNodes DVM Panel. Use this master key to integrate external Discord bots, management bots, and deployment scripts.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => { fetchKeyData(); fetchLogs(); }}
            className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-medium flex items-center gap-1.5 transition-colors border border-white/10"
          >
            <RefreshCw className="w-3.5 h-3.5 text-rose-400" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {feedbackMsg && (
        <div
          className={`p-4 rounded-xl border text-xs flex items-center justify-between ${
            feedbackMsg.type === 'success'
              ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300'
              : 'bg-rose-950/40 border-rose-800/60 text-rose-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedbackMsg.type === 'success' ? <ShieldCheck className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
            <span>{feedbackMsg.text}</span>
          </div>
          <button onClick={() => setFeedbackMsg(null)} className="text-slate-400 hover:text-white text-xs">✕</button>
        </div>
      )}

      {/* Grid: Master Key Card & Quick Status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Master Key Box (2 cols) */}
        <div className="lg:col-span-2 p-6 rounded-2xl bg-[#111219] border border-white/10 space-y-6 shadow-xl">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-700 to-rose-950 p-2 flex items-center justify-center text-rose-200 border border-rose-800/50 shadow-md">
                <KeyRound className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-100">BusterNodes Master Admin API Key</h3>
                <p className="text-xs text-slate-400">Grants full automation access to manage VMs, query status, and deploy instances</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span
                className={`text-[11px] font-mono px-2.5 py-1 rounded-lg border font-semibold flex items-center gap-1.5 ${
                  apiKeyInfo?.status === 'active'
                    ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800/60'
                    : 'bg-rose-950/80 text-rose-300 border-rose-800/60'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${apiKeyInfo?.status === 'active' ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                <span>{apiKeyInfo?.status === 'active' ? 'ACTIVE & OPERATIONAL' : 'REVOKED & DISABLED'}</span>
              </span>
            </div>
          </div>

          {/* Key Display & Copy Action */}
          <div className="space-y-2">
            <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between">
              <span>Bearer Authorization Token</span>
              <span className="text-[10px] text-slate-500 font-normal">SHA-256 Hashed on Storage</span>
            </label>

            <div className="flex items-center gap-2">
              <div className="flex-1 relative flex items-center bg-[#090A0F] border border-white/10 rounded-xl px-3.5 py-2.5 font-mono text-xs text-slate-200 overflow-hidden">
                <span className="truncate select-all">
                  {isRevealed ? rawKeyText : maskedKeyText}
                </span>

                <button
                  type="button"
                  onClick={() => setIsRevealed(!isRevealed)}
                  className="ml-2 text-slate-400 hover:text-slate-200 transition-colors p-1"
                  title={isRevealed ? 'Hide API Key' : 'Reveal API Key'}
                >
                  {isRevealed ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              <button
                type="button"
                onClick={handleCopyKey}
                className="px-4 py-2.5 rounded-xl bg-rose-700 hover:bg-rose-600 text-white text-xs font-semibold flex items-center gap-1.5 transition-all shadow-md shrink-0 active:scale-95"
              >
                {hasCopied ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-300" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>Copy Key</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Key Management Action Buttons */}
          <div className="pt-4 border-t border-white/5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-4 text-xs font-mono text-slate-400">
              <div>
                <span className="text-slate-500">Prefix:</span>{' '}
                <span className="text-slate-300 font-semibold">{apiKeyInfo?.key_prefix || 'dvm_admin_...'}</span>
              </div>
              <div>
                <span className="text-slate-500">Last Used:</span>{' '}
                <span className="text-slate-300">
                  {apiKeyInfo?.last_used_at ? new Date(apiKeyInfo.last_used_at).toLocaleTimeString() : 'Never'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowRevokeConfirm(true)}
                disabled={isRevoking}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors border ${
                  apiKeyInfo?.status === 'active'
                    ? 'bg-rose-950/40 hover:bg-rose-950 text-rose-300 border-rose-900/60'
                    : 'bg-emerald-950/40 hover:bg-emerald-950 text-emerald-300 border-emerald-900/60'
                }`}
              >
                {apiKeyInfo?.status === 'active' ? 'Revoke Key' : 'Enable Key'}
              </button>

              <button
                type="button"
                onClick={() => setShowRegenConfirm(true)}
                disabled={isRegenerating}
                className="px-3.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 text-xs font-semibold flex items-center gap-1.5 transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5 text-rose-400" />
                <span>Regenerate Key</span>
              </button>
            </div>
          </div>
        </div>

        {/* Base URL & Status Overview (1 col) */}
        <div className="p-6 rounded-2xl bg-[#111219] border border-white/10 space-y-4 shadow-xl flex flex-col justify-between">
          <div>
            <h4 className="font-bold text-sm text-slate-100 flex items-center gap-2 mb-3">
              <Server className="w-4 h-4 text-rose-400" />
              <span>API Gateway Connection</span>
            </h4>

            <div className="space-y-3 text-xs">
              <div>
                <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-1">Base REST URL</div>
                <div className="flex items-center gap-2 bg-[#090A0F] border border-white/5 rounded-xl p-2.5 font-mono text-[11px] text-rose-300">
                  <span className="truncate flex-1">{baseUrl}</span>
                  <button
                    onClick={handleCopyUrl}
                    className="p-1 hover:text-white text-slate-400 transition-colors"
                    title="Copy Base URL"
                  >
                    {hasCopiedUrl ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2">
                <div className="p-2.5 rounded-xl bg-[#090A0F] border border-white/5">
                  <div className="text-[10px] text-slate-500 uppercase">Auth Scheme</div>
                  <div className="text-slate-200 font-mono font-bold mt-0.5">Bearer Token</div>
                </div>
                <div className="p-2.5 rounded-xl bg-[#090A0F] border border-white/5">
                  <div className="text-[10px] text-slate-500 uppercase">Architecture</div>
                  <div className="text-rose-300 font-mono font-bold mt-0.5">No-Systemd</div>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-rose-950/20 border border-rose-900/30 text-[11px] text-rose-200 leading-relaxed mt-2">
                External bots must send this header with all requests:
                <div className="font-mono text-[10px] bg-black/50 p-1.5 rounded mt-1.5 text-rose-300 select-all border border-rose-900/40">
                  Authorization: Bearer {apiKeyInfo?.key_prefix || 'dvm_admin_...'}
                </div>
              </div>
            </div>
          </div>

          <div className="text-[10px] text-slate-500 font-mono pt-2 border-t border-white/5 flex items-center justify-between">
            <span>BusterNodes DVM Panel</span>
            <span>Made by Azmal</span>
          </div>
        </div>
      </div>

      {/* Confirmation Modals */}
      {showRegenConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-[#111219] border border-rose-800/80 rounded-2xl p-6 shadow-2xl text-slate-100 space-y-4">
            <div className="flex items-center gap-3 text-rose-400">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h4 className="font-bold text-base text-slate-100">Regenerate Master Admin API Key?</h4>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Regenerating will <strong className="text-rose-400 font-semibold">immediately invalidate</strong> the current key. Any active Discord bots, external automation scripts, or integrations using the previous key will immediately fail until updated with the new key.
            </p>
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
              <button
                type="button"
                onClick={() => setShowRegenConfirm(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRegenerateKey}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-rose-700 hover:bg-rose-600 text-white shadow-lg"
              >
                Yes, Invalidate & Regenerate Key
              </button>
            </div>
          </div>
        </div>
      )}

      {showRevokeConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-[#111219] border border-rose-800/80 rounded-2xl p-6 shadow-2xl text-slate-100 space-y-4">
            <div className="flex items-center gap-3 text-amber-400">
              <Power className="w-6 h-6 shrink-0" />
              <h4 className="font-bold text-base text-slate-100">
                {apiKeyInfo?.status === 'active' ? 'Revoke Admin API Key?' : 'Re-enable Admin API Key?'}
              </h4>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              {apiKeyInfo?.status === 'active'
                ? 'Revoking this key immediately shuts down external API access. All Discord bots and automation scripts will receive 401 KEY_REVOKED until re-enabled.'
                : 'Re-enabling will restore API access for authorized external bots and automation scripts.'}
            </p>
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
              <button
                type="button"
                onClick={() => setShowRevokeConfirm(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleToggleRevoke}
                className={`px-4 py-2 text-xs font-semibold rounded-xl text-white shadow-lg ${
                  apiKeyInfo?.status === 'active' ? 'bg-rose-700 hover:bg-rose-600' : 'bg-emerald-700 hover:bg-emerald-600'
                }`}
              >
                {apiKeyInfo?.status === 'active' ? 'Revoke Access Now' : 'Re-enable Key'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bot-Ready REST Endpoints Reference Table */}
      <div className="p-6 rounded-2xl bg-[#111219] border border-white/10 space-y-4 shadow-xl">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-base text-slate-100 flex items-center gap-2">
              <Terminal className="w-4 h-4 text-rose-400" />
              <span>Bot-Ready REST Endpoints</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Clean versioned JSON endpoints for Discord bots, remote CLI scripts, and orchestrators
            </p>
          </div>
          <span className="text-xs font-mono text-slate-400">10 Endpoints</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-white/10 text-slate-400 uppercase text-[10px] tracking-wider font-semibold">
                <th className="py-2.5 px-3">Method</th>
                <th className="py-2.5 px-3">Endpoint</th>
                <th className="py-2.5 px-3">Description & Purpose</th>
                <th className="py-2.5 px-3">Key Parameters</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 font-mono">
              <tr className="hover:bg-white/[0.02]">
                <td className="py-2.5 px-3"><span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800/40 text-[10px]">GET</span></td>
                <td className="py-2.5 px-3 text-slate-200">/api/v1/status</td>
                <td className="py-2.5 px-3 text-slate-400 font-sans">Check panel status, uptime, host hardware, and Docker state</td>
                <td className="py-2.5 px-3 text-slate-500">None</td>
              </tr>
              <tr className="hover:bg-white/[0.02]">
                <td className="py-2.5 px-3"><span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800/40 text-[10px]">GET</span></td>
                <td className="py-2.5 px-3 text-slate-200">/api/v1/resources</td>
                <td className="py-2.5 px-3 text-slate-400 font-sans">Query real physical CPU cores, RAM availability, and SSD disk free</td>
                <td className="py-2.5 px-3 text-slate-500">None</td>
              </tr>
              <tr className="hover:bg-white/[0.02]">
                <td className="py-2.5 px-3"><span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800/40 text-[10px]">GET</span></td>
                <td className="py-2.5 px-3 text-slate-200">/api/v1/images</td>
                <td className="py-2.5 px-3 text-slate-400 font-sans">List verified Docker OS templates (Ubuntu, Debian, Alpine, Alma, Rocky)</td>
                <td className="py-2.5 px-3 text-slate-500">None</td>
              </tr>
              <tr className="hover:bg-white/[0.02]">
                <td className="py-2.5 px-3"><span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800/40 text-[10px]">GET</span></td>
                <td className="py-2.5 px-3 text-slate-200">/api/v1/vms</td>
                <td className="py-2.5 px-3 text-slate-400 font-sans">List all virtual machines with IP addresses, specs, and status</td>
                <td className="py-2.5 px-3 text-slate-500">None</td>
              </tr>
              <tr className="hover:bg-white/[0.02]">
                <td className="py-2.5 px-3"><span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800/40 text-[10px]">GET</span></td>
                <td className="py-2.5 px-3 text-slate-200">/api/v1/vms/:id</td>
                <td className="py-2.5 px-3 text-slate-400 font-sans">Retrieve detailed configuration for a specific VM instance</td>
                <td className="py-2.5 px-3 text-slate-400">id (path)</td>
              </tr>
              <tr className="hover:bg-white/[0.02]">
                <td className="py-2.5 px-3"><span className="px-2 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800/40 text-[10px]">POST</span></td>
                <td className="py-2.5 px-3 text-slate-200">/api/v1/vms</td>
                <td className="py-2.5 px-3 text-slate-400 font-sans">Create a VM with custom CPU, RAM, and SSD allocation</td>
                <td className="py-2.5 px-3 text-slate-400">name, image, cpu, ram_mb, disk_gb</td>
              </tr>
              <tr className="hover:bg-white/[0.02]">
                <td className="py-2.5 px-3"><span className="px-2 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800/40 text-[10px]">POST</span></td>
                <td className="py-2.5 px-3 text-slate-200">/api/v1/vms/:id/start</td>
                <td className="py-2.5 px-3 text-slate-400 font-sans">Power on stopped virtual machine</td>
                <td className="py-2.5 px-3 text-slate-400">id (path)</td>
              </tr>
              <tr className="hover:bg-white/[0.02]">
                <td className="py-2.5 px-3"><span className="px-2 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800/40 text-[10px]">POST</span></td>
                <td className="py-2.5 px-3 text-slate-200">/api/v1/vms/:id/stop</td>
                <td className="py-2.5 px-3 text-slate-400 font-sans">Graceful shutdown of virtual machine</td>
                <td className="py-2.5 px-3 text-slate-400">id (path)</td>
              </tr>
              <tr className="hover:bg-white/[0.02]">
                <td className="py-2.5 px-3"><span className="px-2 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800/40 text-[10px]">POST</span></td>
                <td className="py-2.5 px-3 text-slate-200">/api/v1/vms/:id/restart</td>
                <td className="py-2.5 px-3 text-slate-400 font-sans">Restart / reboot virtual machine</td>
                <td className="py-2.5 px-3 text-slate-400">id (path)</td>
              </tr>
              <tr className="hover:bg-white/[0.02]">
                <td className="py-2.5 px-3"><span className="px-2 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-800/40 text-[10px]">DELETE</span></td>
                <td className="py-2.5 px-3 text-slate-200">/api/v1/vms/:id</td>
                <td className="py-2.5 px-3 text-slate-400 font-sans">Permanently destroy virtual machine and free host resources</td>
                <td className="py-2.5 px-3 text-slate-400">id (path)</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Helpful Bot Integration Helper & Code Snippets */}
      <div className="p-6 rounded-2xl bg-[#111219] border border-white/10 space-y-4 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-base text-slate-100 flex items-center gap-2">
              <Code2 className="w-4 h-4 text-rose-400" />
              <span>Bot Integration Helper & Code Snippets</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Production-ready bot templates pre-configured with your Master Admin API Key
            </p>
          </div>

          {/* Language / Tool Tabs */}
          <div className="flex items-center p-1 bg-[#090A0F] border border-white/10 rounded-xl">
            <button
              onClick={() => setActiveSnippetTab('discord_js')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                activeSnippetTab === 'discord_js'
                  ? 'bg-rose-950 text-rose-200 border border-rose-800/50 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Discord.js (Node.js)
            </button>
            <button
              onClick={() => setActiveSnippetTab('python_discord')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                activeSnippetTab === 'python_discord'
                  ? 'bg-rose-950 text-rose-200 border border-rose-800/50 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Python (discord.py)
            </button>
            <button
              onClick={() => setActiveSnippetTab('curl')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                activeSnippetTab === 'curl'
                  ? 'bg-rose-950 text-rose-200 border border-rose-800/50 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              cURL (Terminal)
            </button>
          </div>
        </div>

        {/* Code Viewport with Copy Button */}
        <div className="relative">
          <div className="absolute top-3 right-3 z-10">
            <button
              onClick={() => {
                const codeToCopy =
                  activeSnippetTab === 'discord_js'
                    ? discordJsSnippet
                    : activeSnippetTab === 'python_discord'
                    ? pythonSnippet
                    : curlSnippet;
                navigator.clipboard.writeText(codeToCopy);
                alert('Bot code snippet copied to clipboard!');
              }}
              className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-slate-200 text-xs font-semibold flex items-center gap-1.5 backdrop-blur-md border border-white/10 transition-colors"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>Copy Code</span>
            </button>
          </div>

          <pre className="p-4 bg-[#090A0F] border border-white/10 rounded-xl overflow-x-auto text-xs font-mono text-slate-200 leading-relaxed max-h-96">
            <code>
              {activeSnippetTab === 'discord_js' && discordJsSnippet}
              {activeSnippetTab === 'python_discord' && pythonSnippet}
              {activeSnippetTab === 'curl' && curlSnippet}
            </code>
          </pre>
        </div>
      </div>

      {/* Recent Bot & API Activity Logs */}
      <div className="p-6 rounded-2xl bg-[#111219] border border-white/10 space-y-4 shadow-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-rose-400" />
            <h3 className="font-bold text-base text-slate-100">Live API Activity & Bot Debugger</h3>
          </div>
          <span className="text-xs text-slate-400 font-mono">Recent 25 Requests</span>
        </div>

        {logs.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-500">
            No API requests recorded yet. Make a request using the cURL examples above or connect a Discord bot to view live traffic.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-white/10 text-slate-400 uppercase text-[10px] tracking-wider font-semibold">
                  <th className="py-2.5 px-3">Timestamp</th>
                  <th className="py-2.5 px-3">Method</th>
                  <th className="py-2.5 px-3">Endpoint</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Latency</th>
                  <th className="py-2.5 px-3">Origin IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 font-mono">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-white/[0.02]">
                    <td className="py-2 px-3 text-slate-400">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </td>
                    <td className="py-2 px-3">
                      <span className="text-slate-200 font-bold">{log.method}</span>
                    </td>
                    <td className="py-2 px-3 text-slate-300">{log.endpoint}</td>
                    <td className="py-2 px-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          log.status_code < 300
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/40'
                            : log.status_code < 500
                            ? 'bg-amber-950 text-amber-300 border border-amber-800/40'
                            : 'bg-rose-950 text-rose-300 border border-rose-800/40'
                        }`}
                      >
                        {log.status_code}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-slate-400">{log.duration_ms} ms</td>
                    <td className="py-2 px-3 text-slate-500">{log.ip_address}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
