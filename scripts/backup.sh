#!/bin/bash
# scripts/backup.sh — crontab: 0 3 * * * ~/paperclaw/scripts/backup.sh >> ~/backup.log 2>&1
set -euo pipefail
BACKUP_DIR="$HOME/backups"
TS=$(date +%Y%m%d_%H%M%S)
BP="${BACKUP_DIR}/paperclaw_${TS}"
mkdir -p "$BP"
cd ~/paperclaw

echo "=== Backup ${TS} ==="
docker compose --profile full exec -T paperless-db pg_dump -U paperless paperless | gzip > "${BP}/postgres.sql.gz"
tar czf "${BP}/paperless_media.tar.gz" -C data/paperless media/
curl -sf -X POST "http://127.0.0.1:6333/collections/paperclaw_docs/snapshots" || true
cp data/qdrant/collections/paperclaw_docs/snapshots/*.snapshot "${BP}/" 2>/dev/null || true
tar czf "${BP}/openclaw.tar.gz" -C data openclaw/
ls -dt ${BACKUP_DIR}/paperclaw_* 2>/dev/null | tail -n +8 | xargs rm -rf 2>/dev/null || true
echo "Done: $(du -sh "$BP" | cut -f1)"
