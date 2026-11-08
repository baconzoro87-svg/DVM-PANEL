#!/usr/bin/env bash
# ==============================================================================
# BusterNodes DVM Panel — Bootstrap Installer (install.sh)
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

INSTALL_DIR="/opt/DVM-PANEL"
REPO_URL="https://github.com/baconzoro87-svg/DVM-PANEL.git"

print_banner() {
  echo -e "${PURPLE}==============================================================================${NC}"
  echo -e "${WHITE}           BusterNodes DVM Panel — Bootstrap Installer                        ${NC}"
  echo -e "${CYAN}                       Developer: Made by Azmal                               ${NC}"
  echo -e "${PURPLE}==============================================================================${NC}"
}

print_banner

# 1. Root / Sudo Permission Check
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}[Error] This installation script must be run as root or with sudo.${NC}"
  echo -e "${YELLOW}Please run: sudo bash $0${NC}"
  exit 1
fi

echo -e "${BLUE}[1/5] Detecting Operating System and Architecture...${NC}"
OS_NAME="unknown"
ARCH=$(uname -m)

if [ -f /etc/os-release ]; then
  . /etc/os-release
  OS_NAME=$ID
  OS_VERSION=$VERSION_ID
  echo -e "      OS: ${GREEN}${NAME:-$OS_NAME} ${VERSION_ID:-}${NC} (Arch: ${CYAN}${ARCH}${NC})"
else
  echo -e "${YELLOW}[Warning] /etc/os-release not found. Proceeding with generic Linux.${NC}"
fi

# 2. Check and Install Git
echo -e "${BLUE}[2/5] Checking required bootstrap packages (git, curl, ca-certificates)...${NC}"
if ! command -v git &> /dev/null || ! command -v curl &> /dev/null; then
  echo -e "      Installing git and curl..."
  if command -v apt-get &> /dev/null; then
    apt-get update -qq && apt-get install -y -qq git curl ca-certificates
  elif command -v dnf &> /dev/null; then
    dnf install -y -q git curl ca-certificates
  elif command -v yum &> /dev/null; then
    yum install -y -q git curl ca-certificates
  elif command -v apk &> /dev/null; then
    apk add --no-cache git curl ca-certificates
  else
    echo -e "${RED}[Error] Unsupported package manager. Please install git and curl manually.${NC}"
    exit 1
  fi
fi
echo -e "      ${GREEN}Prerequisites verified: git $(git --version | awk '{print $3}') detected.${NC}"

# 3. Clone or Update Repository safely
echo -e "${BLUE}[3/5] Preparing installation directory (${INSTALL_DIR})...${NC}"

if [ -d "$INSTALL_DIR/.git" ]; then
  echo -e "      Existing git repository detected in ${INSTALL_DIR}."
  echo -e "      Safely updating codebase without destroying SQLite databases or configurations..."
  cd "$INSTALL_DIR"
  
  # Preserve local user database and environment files
  git stash -q || true
  git pull origin main || echo -e "${YELLOW}[Warning] Could not pull latest changes from remote. Continuing with local version.${NC}"
  git stash pop -q || true
elif [ -d "$INSTALL_DIR" ]; then
  echo -e "      Directory ${INSTALL_DIR} exists. Entering project directory..."
  cd "$INSTALL_DIR"
else
  echo -e "      Cloning repository from ${REPO_URL} into ${INSTALL_DIR}..."
  mkdir -p "$(dirname "$INSTALL_DIR")"
  git clone "$REPO_URL" "$INSTALL_DIR"
  cd "$INSTALL_DIR"
fi

# 4. Check for run.sh
if [ ! -f "run.sh" ]; then
  echo -e "${RED}[Error] run.sh not found inside ${INSTALL_DIR}.${NC}"
  exit 1
fi

chmod +x run.sh

# 5. Hand off execution to run.sh
echo -e "${BLUE}[4/5] Executing main launcher and installer (run.sh)...${NC}"
echo -e "${PURPLE}------------------------------------------------------------------------------${NC}"

./run.sh "$@"
EXIT_CODE=$?

exit $EXIT_CODE
