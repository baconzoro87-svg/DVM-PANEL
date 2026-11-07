# BusterNodes DVM Panel — Production Deployment Guide
**Panel Name:** DVM Panel  
**Brand:** BusterNodes  
**Developer Credit:** Made by Azmal  
**Architecture:** Non-systemd (PM2 / Supervisor / Docker restart policies)

---

## CRITICAL: Absolute No-Systemd Requirement
This application is designed to run in environments where systemd is absent or not PID 1 (e.g. unprivileged LXC containers, Docker containers, chroots, Alpine Linux, WSL).

### Strictly Prohibited Commands:
- `systemctl`
- `systemd`
- `pm2 startup`
- Systemd service units (`/etc/systemd/system/...`)
- Systemd timers

---

## 1. Supported Operating Systems
- Ubuntu 24.04 LTS (Noble Numbat)
- Ubuntu 22.04 LTS (Jammy Jellyfish)
- Debian 12 (Bookworm)
- Debian 11 (Bullseye)
- Unprivileged LXC Containers with Docker nesting enabled

---

## 2. Docker & Node.js Installation

### On Ubuntu / Debian / LXC:
```bash
# Update repositories
sudo apt update && sudo apt install -y curl git ca-certificates gnupg

# Install Node.js 22 LTS
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs

# Install Docker Engine
sudo apt install -y docker.io
sudo usermod -aG docker $USER

# Verify Docker availability
docker info
```

---

## 3. Clone and Build BusterNodes DVM Panel
```bash
# Clone the repository
git clone https://github.com/busternodes/dvm-panel.git
cd dvm-panel

# Install dependencies
npm install

# Build the frontend assets
npm run build
```

---

## 4. Production Process Management (Non-Systemd)

Use PM2 for process monitoring, automatic restarts upon unhandled exceptions, and log rotation:

```bash
# Install PM2 globally
npm install -g pm2

# Launch DVM Panel server using PM2
pm2 start server.ts --name "dvm-panel" --interpreter tsx

# Save the process state for resurrection
pm2 save

# Check running status
pm2 status

# Inspect application logs
pm2 logs dvm-panel

# Restart or Stop
pm2 restart dvm-panel
pm2 stop dvm-panel
```

### Persistence without systemd:
To resurrect PM2 after container or host reboots without using `pm2 startup`, use crontab:
```bash
(crontab -l 2>/dev/null; echo "@reboot $(which pm2) resurrect") | crontab -
```

---

## 5. Alternative: Docker Deployment with Restart Policy

You can also run BusterNodes DVM Panel within Docker using Docker's native restart policy:

```bash
docker run -d \
  --name dvm-panel \
  --restart unless-stopped \
  -p 3000:3000 \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v $(pwd)/dvm_panel.sqlite:/app/dvm_panel.sqlite \
  -e PORT=3000 \
  busternodes/dvm-panel:latest
```

---

## 6. Default Credentials & API Key
- **Panel Access:** `http://YOUR_SERVER_IP:3000`
- **Default Master API Key:** `dvm_live_busternodes_master_key_99x`
- **REST API Base URL:** `http://YOUR_SERVER_IP:3000/api/v1`
- **Interactive Documentation:** `http://YOUR_SERVER_IP:3000` -> Navigate to "API Documentation"
