#!/bin/bash
# Run ON the VPS to pull and redeploy
# From local: ssh paperclaw@your-vps 'bash ~/paperclaw/scripts/deploy-on-vps.sh'
set -euo pipefail

cd ~/paperclaw

echo "Pulling latest code..."
git pull origin main

echo "Installing dependencies and building..."
cd core && npm ci && npm run build && cd ..

echo "Rebuilding and restarting paperclaw-core..."
docker compose --profile full build paperclaw-core
docker compose --profile full up -d

echo "Checking status..."
docker compose --profile full ps

echo "✅ Deploy complete."
