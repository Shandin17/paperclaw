# PaperClaw Project Memory

## Project Overview
AI-powered document manager Telegram bot. Single Node.js package (not monorepo).
Architecture: Telegram (grammy) → Agent runtime → Paperless-ngx + Qdrant.

## Tech Stack & Exact Versions
- Node.js 24.x (type stripping enabled by default)
- @anthropic-ai/sdk 0.78.0
- openai 6.27.0
- grammy 1.41.1
- @qdrant/js-client-rest 1.17.0
- pino 10.3.1
- zod 4.3.6
- ESLint 9 + neostandard 0.13.x

## Architecture
- **Agents**: chatter → classifier → [indexer, searcher, form-filler, embedder]
- **LLM**: Anthropic Haiku (chatter/indexer/searcher) + Sonnet (classifier) + Opus (form-filler)
- **Embeddings**: OpenAI text-embedding-3-small (1536 dims)
- **Vector DB**: Qdrant collection `documents`
- **Doc storage**: Paperless-ngx at port 8000
- **Bot**: Grammy (Telegram)

## Key Files
- `src/config/env.ts` — Zod-validated env vars (crashes on missing)
- `src/clients/anthropic.ts` — callLLM() with retry (3 attempts, 1s/2s/4s)
- `src/clients/openai.ts` — embed() batched to 100, 1 retry
- `src/clients/paperless.ts` — PaperlessClient class, full REST API
- `src/clients/qdrant.ts` — QdrantClient class, ensureCollection on startup
- `src/utils/chunker.ts` — chunkText() 512 tokens, 64 overlap (word-based)
- `src/utils/file.ts` — temp file management, MIME detection
- `src/utils/logger.ts` — pino logger (pino-pretty in dev)

## TypeScript/Build Setup (per node-best-practices skill)
- `tsconfig.json` — dev config: NodeNext, noEmit, verbatimModuleSyntax, allowImportingTsExtensions
- `tsconfig.build.json` — build config: adds outDir, rewriteRelativeImportExtensions
- `"type": "module"` in package.json (ESM)
- Use `.ts` extensions in imports (not `.js`)
- Use `import type` for type-only imports
- No enums, no namespaces, no constructor parameter properties
- Dev: `node src/index.ts` (type stripping, Node 24+)
- Build: `tsc -p tsconfig.build.json`

## Linting (per linting-neostandard-eslint9 skill)
- `eslint.config.js` — neostandard({ ts: true }) + .gitignore ignores + .agents/**, .claude/**
- No semicolons style (neostandard default)
- Scripts: `npm run lint`, `npm run lint:fix`

## Implementation Status (March 2026)
- [x] Phase 1: Scaffold (package.json, tsconfig, docker-compose, Dockerfile, .env.example, utils)
- [x] Phase 2: External clients (anthropic, openai, paperless, qdrant)
- [ ] Phase 3: Agent runtime (types, registry, runner, invoker, tools, tracing)
- [ ] Phase 4: Agent definitions (6 agents: chatter, classifier, embedder, indexer, searcher, form-filler)
- [ ] Phase 5: Telegram bot layer + entry point

## Data Directory
`data/` is git-ignored. Docker volumes mount there. Traces saved as JSON files in `data/traces/YYYY-MM-DD/`.
