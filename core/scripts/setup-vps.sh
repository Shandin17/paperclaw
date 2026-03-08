#!/bin/bash
# ONE-TIME VPS SETUP — run as root on Ubuntu 24.04
set -euo pipefail

echo "=== PaperClaw VPS Setup ==="

# ── System ────────────────────────────────────────────────────
apt-get update && apt-get upgrade -y
apt-get install -y curl git ufw fail2ban

# ── Swap (2GB for low-RAM servers) ───────────────────────────
if [ ! -f /swapfile ]; then
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
  echo "vm.swappiness=10" >> /etc/sysctl.conf
  sysctl -p
  echo "✓ 2GB swap created"
fi

# ── Docker ────────────────────────────────────────────────────
if ! command -v docker &>/dev/null; then
  curl -fsSL https://get.docker.com | sh
  echo "✓ Docker installed"
fi

# ── Node.js (for build step) ─────────────────────────────────
if ! command -v node &>/dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
  echo "✓ Node.js $(node --version) installed"
fi

# ── Caddy (reverse proxy + TLS) ──────────────────────────────
if ! command -v caddy &>/dev/null; then
  apt-get install -y debian-keyring debian-archive-keyring apt-transport-https
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
  apt-get update && apt-get install -y caddy
  echo "✓ Caddy installed"
fi

# ── paperclaw user ────────────────────────────────────────────
if ! id paperclaw &>/dev/null; then
  useradd -m -s /bin/bash paperclaw
  usermod -aG docker paperclaw
  echo "✓ User 'paperclaw' created"
fi

# ── Firewall ──────────────────────────────────────────────────
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
echo "✓ Firewall configured"

# ── Caddyfile ─────────────────────────────────────────────────
DOMAIN="${PAPERCLAW_DOMAIN:-paperclaw.example.com}"
cat > /etc/caddy/Caddyfile << EOF
${DOMAIN} {
    reverse_proxy 127.0.0.1:8080
}
EOF
systemctl reload caddy
echo "✓ Caddy configured for ${DOMAIN}"

echo ""
echo "=== Setup complete ==="
echo "Next steps:"
echo "  1. Switch to paperclaw user: su - paperclaw"
echo "  2. Clone repo: git clone git@github.com:you/paperclaw.git"
echo "  3. Create .env with secrets"
echo "  4. Build and start: cd core && npm ci && npm run build && cd .."
echo "  5. docker compose --profile full up -d"
