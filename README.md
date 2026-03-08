# PaperClaw

Personal Document AI Assistant — Paperless-ngx + OpenClaw + Claude.

Send documents via Telegram → auto-classified, tagged, stored → query AI agents → get filled PDFs back.

## Agents

- **Gestor** — Spain autónomo tax (IVA, IRPF, Modelo 303/130, expense tracking)
- **Doctor** — Medical document analysis, medication tracking, specialist suggestions
- **ID Docs** — Personal document storage, form auto-fill, expiry alerts

## Stack

Paperless-ngx (storage/OCR) · Qdrant (vector search) · Fastify (API) · OpenClaw (Telegram/WhatsApp) · Claude Haiku (classification) · Claude Sonnet (reasoning) · pdf-lib (form filling)

## Quick Start (Local)

```bash
cp .env.example .env                          # fill in API keys
docker compose --profile infra up -d          # start Paperless + Qdrant
# visit http://localhost:8000, create admin, copy API token → .env
cd core && npm install
npm run setup-paperless                       # create tags & fields
npm run dev                                   # http://localhost:8080
```

## Deploy to VPS

```bash
# On VPS (root): bash scripts/setup-vps.sh
# As paperclaw:
git clone git@github.com:you/paperclaw.git ~/paperclaw
cd ~/paperclaw && nano .env                   # paste production secrets
cd core && npm ci && npm run build && cd ..
docker compose --profile full up -d
```
