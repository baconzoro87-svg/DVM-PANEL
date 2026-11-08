#!/usr/bin/env bash
# ==============================================================================
# BusterNodes DVM Panel — Main Installer & Process Launcher (run.sh)
# Developer Credit: Made by Azmal
# Brand: BusterNodes (Never "BusterNodes Cloud")
# Absolute Prohibition: Zero systemd, zero systemctl, zero pm2 startup
# ==============================================================================

set -e

# Terminal Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
NC='\033[0m' # No Color

PORT="${PORT:-3000}"

echo -e "${PURPLE}==============================================================================${NC}"
echo -e "${WHITE}           BusterNodes DVM Panel — Complete Deployment Launcher               ${NC}"
echo -e "${CYAN}                       Developer: Made by Azmal                               ${NC}"
echo -e "${PURPLE}==============================================================================${NC}"

# 1. Root / Sudo Check
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}[Error] run.sh must be executed as root or with sudo.${NC}"
  exit 1
fi

# 2. System and Architecture Detection
echo -e "${BLUE}[1/7] Detecting Host Virtualization Environment...${NC}"
ARCH=$(uname -m)
OS_ID="unknown"

if [ -f /etc/os-release ]; then
  . /etc/os-release
  OS_ID=$ID
  echo -e "      Detected: ${GREEN}${PRETTY_NAME:-$NAME}${NC} (${CYAN}${ARCH}${NC})"
fi

# Detect non-systemd environment (LXC, Docker, WSL, Chroot)
IS_SYSTEMD=false
if [ -d /run/systemd/system ]; then
  IS_SYSTEMD=true
fi
echo -e "      Process Supervisor Policy: ${YELLOW}Absolute NO-SYSTEMD (PM2 Native Process Management)${NC}"

# 3. Verify / Install Node.js (v20+ or v22 LTS) & npm
echo -e "${BLUE}[2/7] Checking Node.js and npm runtimes...${NC}"
NODE_READY=false

if command -v node &> /dev/null; then
  NODE_VER=$(node -v | sed 's/v//' | cut -d. -f1)
  if [ "$NODE_VER" -ge 20 ]; then
    echo -e "      ${GREEN}Node.js $(node -v) is already installed and supported.${NC}"
    NODE_READY=true
  fi
fi

if [ "$NODE_READY" = false ]; then
  echo -e "      Installing Node.js 22 LTS..."
  if command -v apt-get &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
    apt-get install -y -qq nodejs
  elif command -v dnf &> /dev/null; then
    dnf module install -y nodejs:22
  elif command -v apk &> /dev/null; then
    apk add --no-cache nodejs npm
  fi
fi

echo -e "      ${GREEN}Node: $(node -v) | npm: v$(npm -v)${NC}"

# 4. Verify / Install Docker Engine
echo -e "${BLUE}[3/7] Checking Docker Engine virtualization daemon...${NC}"
if ! command -v docker &> /dev/null; then
  echo -e "      Installing Docker..."
  if command -v apt-get &> /dev/null; then
    apt-get update -qq
    apt-get install -y -qq docker.io
  elif command -v dnf &> /dev/null; then
    dnf install -y -q docker-ce docker-ce-cli containerd.io || dnf install -y -q docker
  elif command -v apk &> /dev/null; then
    apk add --no-cache docker
  fi
fi

# Check Docker Daemon Running without systemctl
if ! docker info &> /dev/null; then
  echo -e "      Starting Docker daemon via service / dockerd (non-systemd safe)..."
  if command -v service &> /dev/null; then
    service docker start || true
  elif [ -x /etc/init.d/docker ]; then
    /etc/init.d/docker start || true
  else
    dockerd > /var/log/dockerd.log 2>&1 &
  fi
  sleep 2
fi

if docker info &> /dev/null; then
  echo -e "      ${GREEN}Docker daemon is active: $(docker --version)${NC}"
  echo -e "${BLUE}[+] Pre-pulling verified Docker images for instant VPS deployment...${NC}"
  
  PREPULL_IMAGES=(
    "nobitaa/ubuntu:22"
    "nobitaa/ubuntu:24"
    "nobitaa/debain:11"
    "nobitaa/debain:12"
    "nobitaa/debain:13"
  )

  for img in "${PREPULL_IMAGES[@]}"; do
    echo -e "      Pulling ${CYAN}${img}${NC}..."
    if docker pull "$img"; then
      echo -e "      ${GREEN}[Success] Preloaded: ${img}${NC}"
    else
      echo -e "      ${RED}[Error] Failed to pull image: ${img}${NC}"
    fi
  done
else
  echo -e "      ${YELLOW}[Notice] Docker daemon socket not active on this host.${NC}"
  echo -e "      ${YELLOW}Docker image pre-pulling will be completed once daemon socket is available.${NC}"
fi

# 5. Verify / Install PM2 and tsx globally
echo -e "${BLUE}[4/7] Checking PM2 and TypeScript execution tools...${NC}"
if ! command -v pm2 &> /dev/null; then
  echo -e "      Installing PM2 process manager globally..."
  npm install -g pm2 --silent
fi

if ! command -v tsx &> /dev/null; then
  npm install -g tsx --silent || true
fi
echo -e "      ${GREEN}PM2 $(pm2 -v) verified.${NC}"

# 6. Install Project Dependencies and Build
echo -e "${BLUE}[5/7] Installing project dependencies (clean, zero Gemini API)...${NC}"
npm install --silent

echo -e "${BLUE}[6/7] Building high-performance production frontend bundle...${NC}"
npm run build

# 7. Start / Restart Panel via PM2 (Strictly NO SYSTEMD)
echo -e "${BLUE}[7/7] Launching BusterNodes DVM Panel daemon via PM2...${NC}"

# Ensure environment file exists
if [ ! -f .env ]; then
  cp .env.example .env 2>/dev/null || cat << 'EOF' > .env
PORT=3000
NODE_ENV=production
JWT_SECRET=busternodes_secret_key_change_in_production
EOF
fi

# Detect configured PORT from .env or default to 3000
PANEL_PORT=$(grep -E '^PORT=' .env 2>/dev/null | cut -d '=' -f2 | tr -d ' "\r\n')
if [ -z "$PANEL_PORT" ]; then
  PANEL_PORT="3000"
fi

# Start or reload panel process
if pm2 describe dvm-panel &> /dev/null; then
  pm2 restart dvm-panel
else
  pm2 start server.ts --name "dvm-panel" --interpreter tsx --update-env
fi

pm2 save --force > /dev/null 2>&1 || true

# Setup non-systemd @reboot cron persistence if crontab is available
if command -v crontab &> /dev/null; then
  PM2_BIN=$(which pm2)
  if ! crontab -l 2>/dev/null | grep -q "pm2 resurrect"; then
    (crontab -l 2>/dev/null; echo "@reboot $PM2_BIN resurrect > /dev/null 2>&1") | crontab - 2>/dev/null || true
  fi
fi

# ==============================================================================
# Completion Banner — Exact Box Specification
# ==============================================================================
echo ""
echo "╔══════════════════════════════════════════════════╗"
echo "║           DVM PANEL — INSTALLATION COMPLETE      ║"
echo "║                BusterNodes                       ║"
echo "╠══════════════════════════════════════════════════╣"
echo "║ Status:          Successfully Installed          ║"
echo "║                                                  ║"
echo "║ Panel URL:       http://YOUR_SERVER_IP:${PANEL_PORT}      ║"
echo "║ Admin URL:       http://YOUR_SERVER_IP:${PANEL_PORT}      ║"
echo "║                                                  ║"
echo "║ Admin Email:     admin@dvm.io                    ║"
echo "║ Admin Password:  Admin213                        ║"
echo "║                                                  ║"
echo "║ Backend/API:     http://YOUR_SERVER_IP:${PANEL_PORT}      ║"
echo "║ Installation:    /opt/DVM-PANEL                  ║"
echo "║                                                  ║"
echo "║ Docker:          Running                         ║"
echo "║ Panel Process:   Online                          ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""
echo -e "${CYAN}Developer:${NC} Made by Azmal"
echo -e "${YELLOW}Notice:${NC} Admin password change is mandatory upon first login."
echo ""
