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

1. Install Docker

curl -fsSL https://get.docker.com | sh  
 sudo usermod -aG docker paperclaw

# Log out and back in for group to take effect

2. Create .env

cd ~/paperclaw
cp .env.example .env
nano .env

# Fill in: POSTGRES_PASSWORD, PAPERLESS_SECRET_KEY, ANTHROPIC_API_KEY, OPENAI_API_KEY

# Leave PAPERLESS_TOKEN empty for now

3. Start infrastructure

docker compose --profile infra up -d

# Wait ~60s for Paperless to initialize

docker compose --profile infra logs paperless -f

# Wait until you see "Listening on http://0.0.0.0:8000"

4. Get Paperless token

docker compose --profile infra exec paperless python manage.py drf_create_token admin

# Copy the token → paste into .env as PAPERLESS_TOKEN

5. Setup Paperless tags & fields

cd core && npm ci
PAPERLESS_URL=http://localhost:8000 npm run setup-paperless
cd ..

6. Build and start the full stack

cd core && npm run build && cd ..
docker compose --profile full up -d

7. Verify

docker compose --profile full ps
curl http://localhost:8081/health
