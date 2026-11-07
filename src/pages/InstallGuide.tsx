import React, { useState } from 'react';
import { Terminal, ShieldAlert, Check, Copy, Server, CheckCircle2, AlertOctagon } from 'lucide-react';

export const InstallGuide: React.FC = () => {
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedSection(id);
      setTimeout(() => setCopiedSection(null), 2000);
    } catch (e) {
      console.error(e);
    }
  };

  const steps = [
    {
      id: 'step1',
      title: '1. Verify Host Prerequisites (Ubuntu 22.04 / 24.04 / Debian / LXC)',
      description: 'Ensure Node.js 20+ or 22+ and Docker engine are installed on your host machine.',
      command: `# Update package lists
sudo apt update && sudo apt install -y curl git ca-certificates gnupg

# Install Node.js 22 LTS
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs

# Verify Docker daemon is present & accessible without systemd
sudo apt install -y docker.io
sudo usermod -aG docker $USER`
    },
    {
      id: 'step2',
      title: '2. Clone & Install BusterNodes DVM Panel',
      description: 'Install dependencies and build production assets.',
      command: `# Clone repository
git clone https://github.com/busternodes/dvm-panel.git
cd dvm-panel

# Install Node dependencies
npm install

# Build production client bundle
npm run build`
    },
    {
      id: 'step3',
      title: '3. Process Management via PM2 (Non-Systemd Safe)',
      description: 'CRITICAL: Never execute "pm2 startup" or "systemctl". Use PM2 process save and supervisor/cron.',
      command: `# Install PM2 globally
npm install -g pm2

# Start BusterNodes DVM Panel
pm2 start server.ts --name "dvm-panel" --interpreter tsx

# Save active process list
pm2 save

# Common non-systemd process controls:
pm2 status
pm2 restart dvm-panel
pm2 logs dvm-panel
pm2 stop dvm-panel`
    },
    {
      id: 'step4',
      title: '4. Non-Systemd Persistence (Docker & Cron Resurrect)',
      description: 'For environments where systemd is absent (LXC containers, Alpine, WSL, Docker-in-Docker), use @reboot crontab or supervisor:',
      command: `# Add automatic resurrect to user crontab without systemd
(crontab -l 2>/dev/null; echo "@reboot $(which pm2) resurrect") | crontab -

# Verify crontab entry
crontab -l`
    },
    {
      id: 'step5',
      title: '5. Docker Compose Deployment (Alternative Self-Contained)',
      description: 'Run the entire panel with automatic container restart policy without host systemd dependencies.',
      command: `# docker-compose.yml
services:
  dvm-panel:
    build: .
    restart: unless-stopped # Absolute non-systemd restart policy
    ports:
      - "3000:3000"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - ./dvm_panel.sqlite:/app/dvm_panel.sqlite
    environment:
      - PORT=3000
      - NODE_ENV=production`
    }
  ];

  return (
    <div className="p-4 lg:p-8 space-y-6 max-w-4xl">
      {/* Top Banner */}
      <div>
        <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
          <span>Non-Systemd Deployment & Operation Guide</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-900/50 font-mono">
            Zero Systemd
          </span>
        </h2>
        <p className="text-xs text-slate-400 mt-1 max-w-2xl">
          Complete production setup guide for BusterNodes DVM Panel on Ubuntu 22.04, Ubuntu 24.04, Debian 12, and LXC virtualization containers.
        </p>
      </div>

      {/* Strict Prohibition Warning Banner */}
      <div className="p-4 rounded-2xl bg-[#17080B] border border-rose-900/60 text-slate-100 space-y-2">
        <div className="flex items-center gap-2 text-rose-400 font-bold text-xs uppercase tracking-wider">
          <AlertOctagon className="w-4 h-4" />
          <span>Strict No-Systemd Mandate</span>
        </div>
        <p className="text-xs text-rose-200/90 leading-relaxed">
          This system is engineered specifically for LXC containers, chroots, and unprivileged virtual environments where systemd is NOT PID 1.
          Commands such as <code className="text-white bg-black/50 px-1 py-0.5 rounded font-mono font-bold">systemctl</code>, <code className="text-white bg-black/50 px-1 py-0.5 rounded font-mono font-bold">pm2 startup</code>, and systemd service files are <strong>strictly prohibited</strong>.
        </p>
      </div>

      {/* Steps List */}
      <div className="space-y-6">
        {steps.map((s) => (
          <div key={s.id} className="p-5 rounded-2xl bg-[#111219] border border-white/5 space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-sm font-bold text-slate-200">{s.title}</h3>
                <p className="text-xs text-slate-400 mt-0.5">{s.description}</p>
              </div>

              <button
                onClick={() => copyToClipboard(s.command, s.id)}
                className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-mono flex items-center gap-1.5 shrink-0 transition-colors"
              >
                {copiedSection === s.id ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>

            <div className="p-3.5 bg-[#090A0F] border border-white/10 rounded-xl font-mono text-xs text-slate-200 overflow-x-auto leading-relaxed">
              <pre>{s.command}</pre>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
