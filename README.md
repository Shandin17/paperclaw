# PaperClaw

Personal Document AI Assistant — Paperless-ngx + OpenClaw + Claude.

Send documents via Telegram → auto-classified, tagged, stored → query AI agents → get filled PDFs back.

## Agents

- **Gestor** — Spain autónomo tax (IVA, IRPF, Modelo 303/130, expense tracking)
- **Doctor** — Medical document analysis, medication tracking, specialist suggestions
- **ID Docs** — Personal document storage, form auto-fill, expiry alerts

## Stack

Paperless-ngx (storage/OCR) · Qdrant (vector search) · Fastify (API) · OpenClaw (Telegram gateway) · Claude Haiku (classification) · Claude Sonnet (reasoning) · pdf-lib (form filling)

---

## VPS Deployment (Full Guide)

### Requirements
- Ubuntu 24.04, 4GB RAM minimum
- Anthropic API key
- OpenAI API key
- Telegram bot token (from @BotFather)

---

### 1. Create dedicated user & install Docker

```bash
sudo adduser paperclaw
sudo usermod -aG docker paperclaw
# If Docker not installed:
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker paperclaw
# Log out and back in, then:
su - paperclaw
```

### 2. Clone the repo

```bash
git clone git@github.com:you/paperclaw.git
cd paperclaw
```

### 3. Create .env

```bash
cp .env.example .env
nano .env
```

```env
POSTGRES_PASSWORD=<random 32 chars>
PAPERLESS_SECRET_KEY=<random string>
PAPERLESS_ADMIN_USER=admin
PAPERLESS_ADMIN_PASSWORD=<secure password>
ANTHROPIC_API_KEY=sk-ant-xxx
OPENAI_API_KEY=sk-xxx
TELEGRAM_BOT_TOKEN=<from @BotFather>
PAPERLESS_TOKEN=     # leave empty for now
```

### 4. Fix data directory permissions

```bash
mkdir -p data
sudo chown -R 1000:1000 data/
```

> The containers run as uid 1000 internally. If you ever see `EACCES` errors, run this again.

### 5. Start infrastructure

```bash
docker compose --profile infra up -d
```

Wait ~60 seconds for Paperless to boot:

```bash
docker compose --profile infra logs paperless -f
# Wait for: "Listening on http://0.0.0.0:8000"
# Ctrl+C to exit
```

### 6. Get Paperless API token

```bash
docker compose --profile infra exec paperless \
  python manage.py drf_create_token admin
```

Copy the token into `.env`:
```
PAPERLESS_TOKEN=<paste here>
```

### 7. Build and start everything

```bash
docker compose --profile full up -d --build
```

Verify all services are up:

```bash
docker compose --profile full ps
```

You should see all 6 containers running:
- `paperclaw-paperless-1` (healthy)
- `paperclaw-paperclaw-core-1` (up)
- `paperclaw-openclaw-1` (healthy)
- `paperclaw-qdrant-1` (up)
- `paperclaw-paperless-db-1` (healthy)
- `paperclaw-paperless-redis-1` (healthy)

```bash
curl http://localhost:8080/health
# {"status":"ok","service":"paperclaw-core",...}
```

### 8. Configure OpenClaw (Telegram)

SSH tunnel from your **local machine**:

```bash
ssh -L 18789:127.0.0.1:18789 -L 18791:127.0.0.1:18791 paperclaw@your-vps-ip
```

Open in browser: `http://localhost:18791/`

In the UI:
1. Add a **Telegram channel** with your bot token
2. Set this **system prompt**:

```
You are PaperClaw, an AI document assistant.

When the user sends a file (photo, PDF, scan): call the paperclaw-ingest skill.
When the user asks questions about documents, tax, medical, or ID: call the paperclaw-query skill.
When the user asks about deadlines or system status: call the paperclaw-status skill.

You handle:
- Tax (Spain autónomo): IVA, IRPF, Modelo 303/130, receipts, invoices
- Medical: prescriptions, lab results, medications
- ID documents: NIE, DNI, passport, official form filling

Answer in the language the user writes in.
```

---

## Subsequent Deploys

```bash
# On VPS as paperclaw user:
cd ~/paperclaw
git pull
docker compose --profile full up -d --build paperclaw-core
```

---

## Local Development

```bash
cp .env.example .env
# Fill in API keys

# Start infrastructure (ports exposed via docker-compose.override.yml)
docker compose --profile infra up -d
# Paperless at http://localhost:8001
# Qdrant at http://localhost:6333

# Get Paperless token
docker compose --profile infra exec paperless \
  python manage.py drf_create_token admin
# Add PAPERLESS_TOKEN to .env

# Run core with hot reload
cd core && npm install && npm run dev
# API at http://localhost:8081
```

---

## Docker Profiles

| Profile | Services started |
|---|---|
| `infra` | postgres, redis, paperless, qdrant |
| `full` | everything including paperclaw-core + openclaw |

```bash
# Start infra only
docker compose --profile infra up -d

# Start full stack
docker compose --profile full up -d

# Stop everything
docker compose --profile full --profile infra down

# Full reset (DESTROYS ALL DATA)
docker compose --profile full --profile infra down -v --remove-orphans
sudo rm -rf data/
```

---

## Troubleshooting

### Permission errors (EACCES)
```bash
sudo chown -R 1000:1000 ~/paperclaw/data/
docker compose --profile full restart
```

### Port already in use
```bash
sudo lsof -i :PORT
# Or restart Docker:
sudo systemctl restart docker
```

### Services fail to start (port conflict between docker-compose.yml and override)
Never define ports in both `docker-compose.yml` and `docker-compose.override.yml` for the same service. Ports live only in the override file for this project.

### OpenClaw out of memory
Already set to `mem_limit: 1200m`. Check RAM with `free -h`.

### Core not reading .env
`.env` must be in the **repo root** (same directory as `docker-compose.yml`), not inside `core/`.
