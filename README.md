# Paperclaw

An AI-powered personal document manager accessible through Telegram. Send documents to your private bot — it OCRs, classifies, and indexes them. Ask questions in plain language to retrieve data, search your archive, or fill forms using your stored documents.

## Requirements

- Node.js 24+
- Docker & Docker Compose
- Telegram bot token ([create via @BotFather](https://t.me/BotFather))
- Anthropic API key
- OpenAI API key (embeddings only)

## Setup

### 1. Clone and install

```bash
git clone <repo>
cd paperclaw
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env`:

```env
TELEGRAM_BOT_TOKEN=your_bot_token
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
PAPERLESS_TOKEN=           # fill after step 4
ALLOWED_CHAT_IDS=   # fill with your Telegram user ID to restrict access
```

### 3. Start infrastructure

```bash
docker compose up -d paperless-redis paperless qdrant
```

Wait ~30 seconds for Paperless to initialize.

### 4. Get the Paperless API token

```bash
docker compose exec paperless python manage.py drf_create_token admin
```

Copy the token into `.env` as `PAPERLESS_TOKEN`.

### 5. Run the bot

**Production via Docker Compose:**

```bash
docker compose up -d
```

**Development** (Node.js type stripping, hot-friendly):

```bash
npm run dev
```

## Commands

| Command | Description |
|---|---|
| `/start` | Welcome message and usage guide |
| `/list` | List all stored documents |
| `/agents` | Show active AI agents |

## Example interactions

```
You:  [sends passport photo]
Bot:  ✅ Saved your passport. Tagged: identity, passport.

You:  What's my passport number?
Bot:  Passport series: 1234, number: 567890, issued: 2020-03-15

You:  [sends blank form PDF] fill this
Bot:  I filled 8 fields. Still need: INN, SNILS. Please provide them.

You:  Find my lease contract
Bot:  Found 1 document: "Lease Contract - Oak St Apt - 2023" (ID: 7)
```

## Development

```bash
npm run typecheck    # type check without emitting
npm run lint         # ESLint (neostandard)
npm run lint:fix     # auto-fix lint issues
npm run build        # compile to dist/ via tsc
```

Trace files are written to `data/traces/YYYY-MM-DD/trace-<id>.json` for every request.

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `TELEGRAM_BOT_TOKEN` | — | Required. Bot token from @BotFather |
| `ANTHROPIC_API_KEY` | — | Required. Anthropic API key |
| `OPENAI_API_KEY` | — | Required. OpenAI API key (embeddings) |
| `PAPERLESS_URL` | `http://paperless:8000` | Paperless-ngx base URL |
| `PAPERLESS_TOKEN` | — | Required. Paperless API token |
| `QDRANT_URL` | `http://qdrant:6333` | Qdrant base URL |
| `QDRANT_COLLECTION` | `documents` | Qdrant collection name |
| `MAX_CALL_DEPTH` | `6` | Max agent-to-agent recursion depth |
| `TRACE_DIR` | `./data/traces` | Directory for trace JSON files |
| `LOG_LEVEL` | `info` | Pino log level |

## Architecture

See [`architecture.md`](./architecture.md) for the full design document.
