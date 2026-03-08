#!/bin/bash
# scripts/setup-vps.sh — Run as root on fresh Ubuntu 24.04 VPS
set -euo pipefail
echo "=== PaperClaw VPS Setup ==="

# System updates
apt update && apt upgrade -y

# Create dedicated user
if ! id paperclaw &>/dev/null; then
    adduser --disabled-password --gecos "PaperClaw" paperclaw
    echo "paperclaw ALL=(ALL) NOPASSWD: ALL" > /etc/sudoers.d/paperclaw
fi

# Install Docker
apt install -y ca-certificates curl gnupg git
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  tee /etc/apt/sources.list.d/docker.list > /dev/null
apt update
apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
usermod -aG docker paperclaw

# Swap (critical for 4GB VPS)
if [ ! -f /swapfile ]; then
    fallocate -l 2G /swapfile
    chmod 600 /swapfile
    mkswap /swapfile
    swapon /swapfile
    echo '/swapfile none swap sw 0 0' >> /etc/fstab
    sysctl vm.swappiness=10
    echo 'vm.swappiness=10' >> /etc/sysctl.conf
fi

# Install Caddy (reverse proxy + auto HTTPS)
apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
apt update
apt install -y caddy

# Firewall
ufw allow OpenSSH
ufw allow 80
ufw allow 443
ufw --force enable

# Create data dirs
su - paperclaw -c 'mkdir -p ~/paperclaw/data/{postgres,paperless/{media,data,consume,export},qdrant,openclaw}'
su - paperclaw -c 'mkdir -p ~/backups'

echo ""
echo "=== Setup complete ==="
echo "Next: git clone your repo as paperclaw user, add .env, start services"
