#!/bin/bash
# scripts/deploy.sh — Run ON the VPS as paperclaw user
set -euo pipefail
echo "=== Deploying PaperClaw ==="

cd ~/paperclaw

# Pull latest
git pull origin main

# Build core service
echo "--- Building core..."
cd core
npm ci
npm run build
cd ..

# Build and restart Docker services
echo "--- Starting services..."
docker compose --profile full build paperclaw-core
docker compose --profile full pull paperless qdrant
docker compose --profile full up -d

# Health check
sleep 15
echo ""
echo "--- Status ---"
docker compose --profile full ps
echo ""
curl -sf http://127.0.0.1:8080/health 2>/dev/null && echo "" || echo "Core not ready yet (give it a moment)"
echo "=== Deploy complete ==="
