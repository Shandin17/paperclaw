# PaperClaw

Ultimate AI-powered document manager. Connects Telegram → OpenClaw → Fastify core → Paperless-ngx + Qdrant.

## Features

- **Smart ingestion**: Photo/PDF → OCR → classify → extract structured data → embed for semantic search
- **Tax assistant (Gestor)**: Answers IVA/IRPF questions; auto-fills Modelo 303, 130, etc.
- **Medical agent (Doctor)**: Tracks medications, test results, prescriptions
- **ID docs agent**: Fills empadronamiento, registration forms from stored ID data
- **Deadline scheduler**: Proactive push notifications before tax deadlines
- **PDF form filling**: Any PDF with form fields can be auto-filled from your data

## Stack

| Layer       | Tech                              |
| ----------- | --------------------------------- |
| Gateway     | OpenClaw (Node.js)                |
| Core API    | Fastify + TypeScript              |
| LLM         | Anthropic Claude (Haiku + Sonnet) |
| Embeddings  | OpenAI text-embedding-3-small     |
| Vector DB   | Qdrant                            |
| Doc storage | Paperless-ngx                     |
| Scheduler   | node-cron                         |
| PDF         | pdf-lib + pdf-parse               |

## Quick Start

```bash
cp .env.example .env
# Fill in API keys

docker compose --profile infra up -d
# Wait ~60s for Paperless to initialize

# Visit http://localhost:8000 to create Paperless admin
# Copy API token to .env as PAPERLESS_TOKEN

cd core && npm install
npm run setup-paperless  # creates tags & custom fields

npm run dev  # hot reload at http://localhost:8080
```

## API Endpoints

| Method | Path       | Description                    |
| ------ | ---------- | ------------------------------ |
| GET    | /health    | Health check                   |
| POST   | /ingest    | Upload document for processing |
| POST   | /query     | Query the AI agents            |
| GET    | /deadlines | Upcoming tax deadlines         |

## Deploy to VPS

```bash
bash scripts/setup-vps.sh  # one-time VPS setup
ssh paperclaw@your-vps 'bash ~/paperclaw/scripts/deploy-on-vps.sh'
```
