#!/bin/bash
# Daily backup script — add to crontab:
# 0 2 * * * /home/paperclaw/paperclaw/scripts/backup.sh >> /var/log/paperclaw-backup.log 2>&1
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/home/paperclaw/backups}"
DATA_DIR="${DATA_DIR:-/home/paperclaw/paperclaw/data}"
DATE=$(date +%Y-%m-%d)
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

mkdir -p "${BACKUP_DIR}"

echo "[${TIMESTAMP}] Starting PaperClaw backup..."

# ── Paperless export ──────────────────────────────────────────
echo "Exporting Paperless documents..."
docker compose -f /home/paperclaw/paperclaw/docker-compose.yml \
  --profile full exec -T paperless \
  document_exporter /usr/src/paperless/export --no-progress-bar

# ── Archive export + postgres + qdrant ────────────────────────
ARCHIVE="${BACKUP_DIR}/paperclaw_${DATE}.tar.gz"
tar -czf "${ARCHIVE}" \
  "${DATA_DIR}/paperless/export/" \
  "${DATA_DIR}/postgres/" \
  "${DATA_DIR}/qdrant/" \
  2>/dev/null || true

SIZE=$(du -sh "${ARCHIVE}" | cut -f1)
echo "[${TIMESTAMP}] Backup created: ${ARCHIVE} (${SIZE})"

# ── Rotate — keep last 7 days ─────────────────────────────────
find "${BACKUP_DIR}" -name "paperclaw_*.tar.gz" -mtime +7 -delete
echo "[${TIMESTAMP}] Old backups cleaned. Done."
