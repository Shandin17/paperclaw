# Paperclaw — Architecture Document

> **Purpose:** This document is the single source of truth for implementing Paperclaw.
> It covers every module, file, data structure, API contract, and runtime behavior.
> Follow it linearly — each section builds on the previous one.

---

## Table of Contents

1. [Technology Choices & Versions](#1-technology-choices--versions)
2. [Project Directory Structure](#2-project-directory-structure)
3. [Configuration & Environment](#3-configuration--environment)
4. [Infrastructure — Docker Compose](#4-infrastructure--docker-compose)
5. [Core Runtime — Agent Framework](#5-core-runtime--agent-framework)
6. [Agent Definitions — Built-in Agents](#6-agent-definitions--built-in-agents)
7. [External Service Clients](#7-external-service-clients)
8. [Telegram Bot Layer](#8-telegram-bot-layer)
9. [Data Models & Schemas](#9-data-models--schemas)
10. [Request Lifecycle — End-to-End Flows](#10-request-lifecycle--end-to-end-flows)
11. [Tracing & Observability](#11-tracing--observability)
12. [Error Handling Strategy](#12-error-handling-strategy)
13. [Implementation Order](#13-implementation-order)

---

## 1. Technology Choices & Versions

| Concern            | Choice                | Version / Notes                              |
| ------------------ | --------------------- | -------------------------------------------- |
| Language           | TypeScript            |                                              |
| Runtime            | Node.js               | 24.x LTS                                     |
| Package manager    | npm                   | Workspace not needed (single package)        |
| Telegram framework | Grammy                | Latest stable                                |
| AI — LLM           | Anthropic Claude API  | `@anthropic-ai/sdk`                          |
| AI — Embeddings    | OpenAI embeddings API | `openai` SDK, model `text-embedding-3-small` |
| Document storage   | Paperless-ngx         | Latest Docker image, REST API v3             |
| Vector database    | Qdrant                | Latest Docker image, REST/gRPC client        |

---

## 2. Project Directory Structure

```
paperclaw/
├── docker-compose.yml
├── Dockerfile
├── .env.example
├── .env                          # git-ignored
├── package.json
├── tsconfig.json
│
├── src/
│   ├── index.ts                  # Entry point: boots bot + agent registry
│   │
│   ├── config/
│   │   └── env.ts                # Typed env loader (schema)
│   │
│   ├── bot/
│   │   ├── bot.ts                # Grammy bot instance + middleware setup
│   │   ├── handlers/
│   │   │   ├── message.ts        # Text message handler → pipes to Chatter
│   │   │   ├── document.ts       # File upload handler → pipes to Chatter with file refs
│   │   │   └── command.ts        # /start, /list, /agents handlers
│   │   └── context.ts            # Grammy custom context type
│   │
│   ├── runtime/
│   │   ├── registry.ts           # AgentRegistry: loads & stores all agent definitions
│   │   ├── runner.ts             # AgentRunner: executes an agent (LLM call + tool dispatch)
│   │   ├── invoker.ts            # invoke() function factory — given to each agent
│   │   ├── loop-guard.ts         # Call depth tracker, prevents infinite recursion
│   │   └── types.ts              # Shared runtime types (AgentDefinition, InvokeResult, etc.)
│   │
│   ├── agents/                   # Each agent = folder with manifest.json + SKILL.md
│   │   ├── chatter/
│   │   │   ├── manifest.json
│   │   │   └── SKILL.md
│   │   ├── classifier/
│   │   │   ├── manifest.json
│   │   │   └── SKILL.md
│   │   ├── embedder/
│   │   │   ├── manifest.json
│   │   │   ├── SKILL.md
│   │   │   └── index.ts          # Custom runner: calls OpenAI embedding API directly
│   │   ├── indexer/
│   │   │   ├── manifest.json
│   │   │   └── SKILL.md
│   │   ├── searcher/
│   │   │   ├── manifest.json
│   │   │   └── SKILL.md
│   │   └── form-filler/
│   │       ├── manifest.json
│   │       └── SKILL.md
│   │
│   ├── clients/
│   │   ├── anthropic.ts          # Anthropic SDK wrapper — model call helper
│   │   ├── openai.ts             # OpenAI SDK wrapper — embedding helper
│   │   ├── paperless.ts          # Paperless-ngx REST API client
│   │   └── qdrant.ts             # Qdrant REST client
│   │
│   ├── tools/                    # Tool implementations agents can use
│   │   ├── registry.ts           # ToolRegistry: maps tool names → handlers
│   │   ├── paperless.tool.ts     # CRUD operations against Paperless-ngx
│   │   └── qdrant.tool.ts        # Search / upsert operations against Qdrant
│   │
│   ├── tracing/
│   │   ├── trace.ts              # Trace tree data structure + context propagation
│   │   └── store.ts              # Persists completed traces (JSON files or SQLite)
│   │
│   └── utils/
│       ├── chunker.ts            # Text chunking (512 tokens, 64 overlap)
│       ├── file.ts               # Temp file management, MIME detection
│       └── logger.ts             # Structured logger (pino)
│
└── data/                         # Docker volume mount points (git-ignored)
    ├── paperless/
    │   ├── media/
    │   ├── data/
    │   └── consume/
    ├── qdrant/
    └── traces/
```

---

## 3. Configuration & Environment

### `.env.example`

```env
# --- Telegram ---
TELEGRAM_BOT_TOKEN=

# --- Anthropic ---
ANTHROPIC_API_KEY=

# --- OpenAI (embeddings only) ---
OPENAI_API_KEY=

# --- Paperless-ngx ---
PAPERLESS_URL=http://paperless:8000
PAPERLESS_TOKEN=                  # API token generated in Paperless admin

# --- Qdrant ---
QDRANT_URL=http://qdrant:6333
QDRANT_COLLECTION=documents

# --- Runtime ---
MAX_CALL_DEPTH=6                  # Agent invocation recursion limit
TRACE_DIR=./data/traces           # Where trace JSON files are written
LOG_LEVEL=info                    # pino log level
```

### `src/config/env.ts`

Use schema to define and validate the schema at startup. Export a typed `config` object. Crash immediately if any required variable is missing.

---

## 4. Infrastructure — Docker Compose

### `docker-compose.yml`

Four services: `bot`, `paperless`, `qdrant`, and `paperless-redis` (required by Paperless-ngx).

```yaml
version: "3.8"

services:
  bot:
    build: .
    restart: unless-stopped
    depends_on:
      paperless:
        condition: service_healthy
      qdrant:
        condition: service_healthy
    env_file: .env
    volumes:
      - ./data/traces:/app/data/traces
    networks:
      - paperclaw

  paperless-redis:
    image: redis:7
    restart: unless-stopped
    networks:
      - paperclaw

  paperless:
    image: ghcr.io/paperless-ngx/paperless-ngx:latest
    restart: unless-stopped
    depends_on:
      - paperless-redis
    environment:
      PAPERLESS_REDIS: redis://paperless-redis:6379
      PAPERLESS_URL: http://paperless:8000
      PAPERLESS_ADMIN_USER: admin
      PAPERLESS_ADMIN_PASSWORD: ${PAPERLESS_ADMIN_PASSWORD:-changeme}
      PAPERLESS_OCR_LANGUAGES: rus+eng
      PAPERLESS_FILENAME_FORMAT: "{document_type}/{created_year}/{title}"
    volumes:
      - ./data/paperless/data:/usr/src/paperless/data
      - ./data/paperless/media:/usr/src/paperless/media
      - ./data/paperless/consume:/usr/src/paperless/consume
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000"]
      interval: 10s
      timeout: 5s
      retries: 10
    networks:
      - paperclaw

  qdrant:
    image: qdrant/qdrant:latest
    restart: unless-stopped
    volumes:
      - ./data/qdrant:/qdrant/storage
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:6333/healthz"]
      interval: 5s
      timeout: 3s
      retries: 5
    networks:
      - paperclaw

networks:
  paperclaw:
    driver: bridge
```

### `Dockerfile` (for the bot)

```dockerfile
fill docker file
```

### Qdrant collection bootstrap

On first startup, `src/clients/qdrant.ts` must ensure the collection exists:

```
PUT /collections/documents
{
  "vectors": {
    "size": 1536,          // text-embedding-3-small output dimension
    "distance": "Cosine"
  }
}
```

If the collection already exists, skip creation.

---

## 5. Core Runtime — Agent Framework

This is the heart of the system. It loads agent definitions, runs them, and wires up inter-agent invocation.

### 5.1 `src/runtime/types.ts` — Shared Types

```ts
export interface AgentManifest {
  name: string;
  description: string;
  triggers?: string[];
  model: string;
  tools: string[]; // names of tools this agent may use
  parallel: boolean;
  canInvoke: "any" | string[]; // which agents this agent may call
  trace: boolean;
  inputSchema: JSONSchema;
  outputSchema: JSONSchema;
}

/** Full agent definition loaded at startup */
export interface AgentDefinition {
  manifest: AgentManifest;
  systemPrompt: string; // contents of SKILL.md
  customRunner?: CustomRunnerFn; // if index.ts exists
}

/** Function signature for custom runners (e.g., embedder) */
export type CustomRunnerFn = (
  input: Record<string, unknown>,
  context: AgentContext,
) => Promise<AgentOutput>;

/** Passed to every agent execution */
export interface AgentContext {
  invoke: InvokeFn; // call another agent
  tools: ToolRegistry; // access to tool implementations
  traceNode: TraceNode; // current node in the trace tree
  config: Config;
}

export type InvokeFn = (
  agentName: string,
  input: Record<string, unknown>,
) => Promise<AgentOutput>;

export interface AgentOutput {
  result: Record<string, unknown>;
  traceNode: TraceNode;
}

export interface TraceNode {
  id: string; // uuid
  agent: string;
  model: string;
  input: string; // summary / truncated
  output: string; // summary / truncated
  startedAt: number; // Date.now()
  completedAt?: number;
  latencyMs?: number;
  tokenUsage?: { input: number; output: number };
  children: TraceNode[];
  error?: string;
}
```

### 5.2 `src/runtime/registry.ts` — Agent Registry

**Startup behavior:**

1. Scan `src/agents/` for subdirectories.
2. For each subdirectory, read `manifest.json` (parse and validate) and `SKILL.md` (read as UTF-8 string).
3. If `index.ts` (compiled to `index.js`) exists, `import()` it and extract the default export as `CustomRunnerFn`.
4. Store everything in a `Map<string, AgentDefinition>`.

**Public API:**

```ts
class AgentRegistry {
  private agents: Map<string, AgentDefinition>;

  async loadAll(agentsDir: string): Promise<void>;
  get(name: string): AgentDefinition | undefined;
  getAll(): AgentDefinition[];
  names(): string[];
  manifests(): AgentManifest[]; // used by Classifier to know available agents
}
```

### 5.3 `src/runtime/runner.ts` — Agent Runner

Executes a single agent. Two code paths:

**Path A — Custom runner exists:**
Call `agentDef.customRunner(input, context)` directly.

**Path B — Default runner (LLM call):**

1. Build the messages array:
   - `system`: The agent's `SKILL.md` content + a JSON block listing available agents (from registry) + available tools.
   - `user`: JSON-serialized `input`.
2. If the agent has `tools`, convert them to Anthropic tool definitions and include in the API call.
3. Call the Anthropic API with the agent's specified `model`.
4. If the response contains tool_use blocks, execute the tools via `ToolRegistry`, feed results back, and loop (standard Anthropic tool-use loop, max 10 iterations).
5. Parse the final text response as JSON matching `outputSchema`.
6. Return `AgentOutput`.

**Tool-use loop pseudocode:**

```
messages = [{ role: "user", content: serializedInput }]
loop (max 10):
    response = anthropic.messages.create({ model, system, messages, tools })
    if response has no tool_use blocks:
        break
    for each tool_use block:
        result = toolRegistry.execute(toolName, toolInput)
        append tool_result to messages
    append assistant message to messages
parse final text content as JSON → AgentOutput
```

### 5.4 `src/runtime/invoker.ts` — Invoke Function Factory

Creates the `invoke()` function that is given to each agent. This function:

1. Checks call depth via `LoopGuard`. If `MAX_CALL_DEPTH` exceeded, throw `MaxDepthError`.
2. Checks that the calling agent's `canInvoke` permits calling the target agent.
3. Looks up the target `AgentDefinition` from the registry.
4. Creates a child `TraceNode`.
5. Calls `AgentRunner.run(targetAgent, input, childContext)`.
6. Records latency and token usage on the `TraceNode`.
7. Returns `AgentOutput`.

```ts
function createInvokeFn(
  callerAgent: string,
  registry: AgentRegistry,
  runner: AgentRunner,
  loopGuard: LoopGuard,
  parentTraceNode: TraceNode,
): InvokeFn;
```

### 5.5 `src/runtime/loop-guard.ts` — Recursion Guard

Simple depth counter scoped per request.

```ts
class LoopGuard {
  private depth: number = 0;
  private maxDepth: number;

  constructor(maxDepth: number);
  enter(): void; // depth++; if depth > max throw MaxDepthError
  exit(): void; // depth--
}
```

A new `LoopGuard` instance is created per incoming Telegram message.

---

## 6. Agent Definitions — Built-in Agents

All manifest.json and SKILL.md contents are specified in the original spec document. Copy them verbatim into the corresponding `src/agents/<name>/` directories.

Below are implementation notes for each agent beyond what the manifest/SKILL already describe.

### 6.1 Chatter

- **Runner:** Default (LLM call).
- **Model:** `claude-haiku-4-5-20251001`
- **No tools.** It only uses `invoke()` to call `classifier`.
- **System prompt injection:** Before calling the LLM, append to the system prompt a section listing the user's recent conversation history (last 10 messages), passed via `input.history`.
- **Delegation logic:** The LLM decides when to delegate. The SKILL.md instructs it on criteria. The output JSON has `delegated: boolean`. If `true`, the `result.reply` already contains the Classifier's merged output relayed through Chatter.

**Conversation history:** The bot layer (`src/bot/handlers/message.ts`) maintains an in-memory per-chat message buffer (last 20 messages). This is passed as `input.history` to Chatter. Use a `Map<chatId, Message[]>` with an LRU eviction policy (max 1000 chats).

### 6.2 Classifier

- **Runner:** Default (LLM call).
- **Model:** `claude-sonnet-4-6`
- **No tools.** Uses only `invoke()`.
- **System prompt injection:** Append the full list of registered agent manifests (name + description + triggers) as a JSON array so the LLM can make routing decisions.
- **Parallel invocation:** When the LLM outputs multiple agent names in its `agents` array, the runner must invoke them with `Promise.all()` if each agent's manifest has `parallel: true`. Otherwise invoke sequentially.
- **Result merging:** After all agents return, pass their combined outputs back to the Classifier LLM in a follow-up message asking it to merge into a single coherent `reply`.

### 6.3 Embedder

- **Runner:** Custom (`index.ts`).
- **Does NOT call the Anthropic API.** Instead:
  1. Chunks the input text using `src/utils/chunker.ts`.
  2. Calls OpenAI `text-embedding-3-small` for each chunk (batch if API supports it).
  3. Upserts vectors into Qdrant via `src/clients/qdrant.ts`.
  4. Returns `{ vectorId, dimensions: 1536 }`.

### 6.4 Indexer

- **Runner:** Default (LLM call).
- **Model:** `claude-haiku-4-5-20251001`
- **Tools:** `paperless` (via tool registry).
- **After the LLM classifies and tags the document,** it must invoke `embedder` with the OCR text. This happens inside the LLM tool-use loop: the LLM calls a pseudo-tool `invoke_agent` which the runner intercepts and routes through `invoke()`.

**Alternative design (simpler):** Instead of making agent invocation a tool, have the runner check the Indexer's output for a `triggerEmbedder: true` flag, and if set, the runner itself calls `invoke("embedder", ...)` post-LLM. This avoids complex tool plumbing. **Use this approach.**

### 6.5 Searcher

- **Runner:** Default (LLM call).
- **Model:** `claude-haiku-4-5-20251001`
- **Tools:** `qdrant` (semantic search), `paperless` (fetch document by ID / download file).
- **Mode handling:** The `mode` field in the input schema (`document`, `data`, `both`) is part of the user message to the LLM. The SKILL.md instructs the LLM on how to behave per mode. The tools give it the ability to search and fetch.

### 6.6 Form-Filler

- **Runner:** Default (LLM call).
- **Model:** `claude-opus-4-6`
- **Tools:** `qdrant`, `paperless`.
- **Uses `invoke()`:** Calls `searcher` to find relevant documents.
- **The form image/PDF** is passed to the LLM as an image content block (Anthropic vision). The LLM analyzes the form visually.
- **Output:** A list of `{ fieldName, value, sourceDoc }` objects + `missingFields`. The Chatter relays missing fields to the user and re-invokes Form-Filler once the user provides them.

---

## 7. External Service Clients

### 7.1 `src/clients/anthropic.ts`

Thin wrapper around `@anthropic-ai/sdk`.

```ts
interface LLMCallParams {
  model: string;
  system: string;
  messages: Anthropic.MessageParam[];
  tools?: Anthropic.Tool[];
  maxTokens?: number; // default 4096
}

interface LLMCallResult {
  content: Anthropic.ContentBlock[];
  usage: { inputTokens: number; outputTokens: number };
  stopReason: string;
}

async function callLLM(params: LLMCallParams): Promise<LLMCallResult>;
```

- Set `max_tokens` per agent: Chatter/Indexer/Searcher → 2048, Classifier → 4096, Form-Filler → 8192.
- For Form-Filler, pass the form image as a base64 `image` content block in the user message.

### 7.2 `src/clients/openai.ts`

Thin wrapper for embedding only.

```ts
async function embed(texts: string[]): Promise<number[][]>;
```

Calls `openai.embeddings.create({ model: "text-embedding-3-small", input: texts })`.
Returns the array of embedding vectors. Batch up to 100 texts per call.

### 7.3 `src/clients/paperless.ts`

REST client for Paperless-ngx API v3. All calls use `Authorization: Token <PAPERLESS_TOKEN>` header.

```ts
class PaperlessClient {
  /** Upload a document file. Returns the task ID (async processing). */
  async upload(
    file: Buffer,
    filename: string,
    metadata?: {
      title?: string;
      tags?: number[];
      documentType?: number;
    },
  ): Promise<string>; // task UUID

  /** Poll task until complete, return document ID. */
  async awaitTask(taskId: string, timeoutMs?: number): Promise<number>;

  /** Get document metadata by ID. */
  async getDocument(id: number): Promise<PaperlessDocument>;

  /** Download the original file. */
  async downloadOriginal(id: number): Promise<Buffer>;

  /** Download the archived (OCR'd) PDF. */
  async downloadArchived(id: number): Promise<Buffer>;

  /** Search documents by text query (Paperless full-text search). */
  async search(query: string, limit?: number): Promise<PaperlessDocument[]>;

  /** List all documents. */
  async list(page?: number, pageSize?: number): Promise<PaperlessDocument[]>;

  /** Create a tag if it doesn't exist. Return tag ID. */
  async ensureTag(name: string): Promise<number>;

  /** Create a document type if it doesn't exist. Return type ID. */
  async ensureDocumentType(name: string): Promise<number>;

  /** Update document metadata (title, tags, etc.). */
  async updateDocument(
    id: number,
    updates: Partial<PaperlessDocument>,
  ): Promise<void>;
}

interface PaperlessDocument {
  id: number;
  title: string;
  content: string; // OCR text
  tags: number[];
  document_type: number | null;
  created: string; // ISO date
  original_file_name: string;
  download_url: string; // relative API path
}
```

### 7.4 `src/clients/qdrant.ts`

REST client for Qdrant.

```ts
class QdrantClient {
  /** Ensure collection exists with correct config. */
  async ensureCollection(): Promise<void>;

  /** Upsert vectors with metadata. */
  async upsert(points: QdrantPoint[]): Promise<void>;

  /** Semantic search — returns top N matches. */
  async search(
    vector: number[],
    limit?: number,
    filter?: QdrantFilter,
  ): Promise<QdrantSearchResult[]>;

  /** Delete all points for a given documentId. */
  async deleteByDocumentId(documentId: string): Promise<void>;
}

interface QdrantPoint {
  id: string; // uuid
  vector: number[];
  payload: {
    documentId: string;
    chunkIndex: number;
    text?: string; // Optional: small excerpt for display (NOT the full chunk)
  };
}

interface QdrantSearchResult {
  id: string;
  score: number;
  payload: QdrantPoint["payload"];
}
```

---

## 8. Telegram Bot Layer

### 8.1 `src/bot/bot.ts`

Initialize Grammy bot. Attach middleware and handlers.

```ts
import { Bot } from "grammy";

const bot = new Bot(config.TELEGRAM_BOT_TOKEN);

// Middleware order:
// 1. Error handler (catch-all)
// 2. Logger (log every update)
// 3. Conversation history collector
// 4. Command handlers (/start, /list, /agents)
// 5. Document handler (file uploads)
// 6. Text message handler (everything else)

export { bot };
```

### 8.2 `src/bot/handlers/message.ts`

**Text message handler:**

1. Get or create conversation history for `ctx.chat.id`.
2. Append user message to history.
3. Build `ChatterInput`: `{ message: ctx.message.text, history }`.
4. Create a new `LoopGuard` and root `TraceNode`.
5. Call `runner.run("chatter", chatterInput, context)`.
6. Send `result.reply` back to the user via `ctx.reply()`.
7. Append bot reply to history.
8. Persist the trace.

### 8.3 `src/bot/handlers/document.ts`

**File upload handler:**

1. Download the file from Telegram using `ctx.getFile()` + `bot.api.getFile()`.
2. Save to a temp directory.
3. Determine MIME type.
4. Build `ChatterInput`: `{ message: ctx.message.caption || "New document", files: [tempFilePath], history }`.
5. Same flow as text handler — Chatter decides to delegate to Classifier, which routes to Indexer.

**File passing between agents:** Files are referenced by local temp path. When the Indexer needs to upload to Paperless, it reads from this path. The path is passed through `input.files` or `input.fileUrl`.

### 8.4 `src/bot/handlers/command.ts`

| Command   | Behavior                                                                 |
| --------- | ------------------------------------------------------------------------ |
| `/start`  | Send welcome message explaining what the bot does. Store user in memory. |
| `/list`   | Call `paperlessClient.list()`, format as a numbered list, send to user.  |
| `/agents` | Call `registry.names()`, format agent list with descriptions, send.      |

---

## 9. Data Models & Schemas

### 9.1 Conversation History Entry

```ts
interface HistoryMessage {
  role: "user" | "assistant";
  text: string;
  files?: string[]; // file URLs or paths
  timestamp: number;
}
```

Stored in-memory per chat in `Map<number, HistoryMessage[]>`. Max 20 messages per chat. Max 1000 chats in the map (LRU eviction).

### 9.2 Qdrant Collection Schema

- **Collection name:** `documents` (configurable via env).
- **Vector size:** 1536 (text-embedding-3-small output).
- **Distance metric:** Cosine.
- **Payload schema:**

```json
{
  "documentId": "string", // Paperless document ID as string
  "chunkIndex": "integer", // Position within the document
  "title": "string", // Document title from Paperless
  "documentType": "string" // passport, contract, etc.
}
```

### 9.3 Trace Schema

See section 11 for full trace structure.

---

## 10. Request Lifecycle — End-to-End Flows

### Flow 1: User sends a document (e.g., passport photo)

```
1. Telegram → document handler
2. Download file to /tmp/paperclaw/<uuid>.jpg
3. Create ChatterInput { message: "New document", files: ["/tmp/...jpg"], history }
4. Run Chatter agent
5. Chatter LLM sees a file → decides to delegate
6. Chatter invoke("classifier", { task: "Index new document", files: [...], history })
7. Classifier LLM sees new file → selects ["indexer"]
8. Classifier invoke("indexer", { fileUrl: "/tmp/...jpg", mimeType: "image/jpeg" })
9. Indexer LLM:
   a. Uses paperless tool → upload file
   b. Awaits Paperless task → gets documentId
   c. Gets OCR text from Paperless document content
   d. Classifies as "passport", generates title, creates/finds tags
   e. Updates document metadata in Paperless
   f. Returns { documentId, documentType: "passport", tags: [...], title: "..." }
10. Runner sees output → triggers embedder:
    invoke("embedder", { text: ocrText, documentId })
11. Embedder custom runner:
    a. Chunks text
    b. Calls OpenAI embeddings
    c. Upserts to Qdrant
    d. Returns { vectorId }
12. Indexer result bubbles up to Classifier
13. Classifier merges → returns reply: "Saved your passport. Tagged: identity, passport."
14. Chatter relays to user
15. Telegram ← "Got it! I've saved your passport. 📄"
```

### Flow 2: User asks "my passport data"

```
1. Telegram → message handler
2. ChatterInput { message: "my passport data", history }
3. Chatter LLM → delegates
4. Chatter invoke("classifier", { task: "Extract passport data", history })
5. Classifier LLM → selects ["searcher"]
6. Classifier invoke("searcher", { query: "passport", mode: "data" })
7. Searcher LLM:
   a. Uses qdrant tool → embed query, search → finds passport chunks
   b. Uses paperless tool → fetch full document by ID
   c. Extracts structured data from OCR text
   d. Returns { documents: [...], answer: "Series: 1234 ..." }
8. Classifier merges → reply with extracted data
9. Chatter relays
10. Telegram ← "Series: 1234 567890\nIssued by: ..."
```

### Flow 3: User sends a blank form + "fill this"

```
1. Telegram → document handler
2. Download form to /tmp/paperclaw/<uuid>.pdf
3. ChatterInput { message: "fill this", files: [...], history }
4. Chatter → delegates
5. Classifier → selects ["form-filler"]
6. Classifier invoke("form-filler", { formFileUrl: "/tmp/...pdf", mimeType: "application/pdf" })
7. Form-Filler LLM (opus):
   a. Receives form as image content block → analyzes fields
   b. invoke("searcher", { query: "passport identity INN", mode: "data" })
   c. Maps fields to retrieved data
   d. Identifies missing fields (e.g., INN)
   e. Returns { fields: [...], missingFields: ["INN"] }
8. Classifier merges → reply includes filled data + asks for missing
9. Chatter relays
10. Telegram ← "I filled 12 fields. I still need your INN to complete the form."
11. User sends INN → flow restarts, Form-Filler gets the INN from history
```

### Flow 4: Simple greeting ("Hello!")

```
1. Telegram → message handler
2. ChatterInput { message: "Hello!", history }
3. Chatter LLM → no delegation needed
4. Returns { reply: "Hi! Send me documents to store, or ask about ones I already have.", delegated: false }
5. Telegram ← "Hi! Send me documents..."
```

---

## 11. Tracing & Observability

### 11.1 `src/tracing/trace.ts`

Every user request creates one root `TraceNode`. Every agent invocation creates a child node. The tree captures the full call graph.

```ts
interface TraceNode {
  id: string; // uuid v4
  agent: string; // agent name
  model: string; // model used
  input: string; // first 200 chars of JSON input
  output: string; // first 200 chars of JSON output
  startedAt: number; // epoch ms
  completedAt: number; // epoch ms
  latencyMs: number;
  tokenUsage: {
    input: number;
    output: number;
  } | null;
  children: TraceNode[];
  error: string | null;
}

interface RequestTrace {
  traceId: string; // uuid v4
  chatId: number; // Telegram chat ID
  userMessage: string; // original user message (truncated)
  rootNode: TraceNode;
  totalLatencyMs: number;
  totalTokens: { input: number; output: number };
  timestamp: string; // ISO date
}
```

### 11.2 `src/tracing/store.ts`

Write each `RequestTrace` as a JSON file to `TRACE_DIR`:

```
data/traces/2025-03-10/trace-<traceId>.json
```

Organized by date for easy browsing. No database needed for v1.

---

## 12. Error Handling Strategy

| Error Type                   | Where          | Behavior                                                                                         |
| ---------------------------- | -------------- | ------------------------------------------------------------------------------------------------ |
| `MaxDepthError`              | `invoker.ts`   | Return error message to Classifier/Chatter. Don't crash.                                         |
| Anthropic API 429 / 5xx      | `anthropic.ts` | Retry with exponential backoff (3 attempts, 1s/2s/4s).                                           |
| OpenAI API error             | `openai.ts`    | Retry once. If still fails, skip embedding, log warning.                                         |
| Paperless upload timeout     | `paperless.ts` | Poll for 120s max. If timeout, report to user.                                                   |
| Qdrant unreachable           | `qdrant.ts`    | Retry once. If down, skip embedding, log error.                                                  |
| LLM returns unparseable JSON | `runner.ts`    | Retry the LLM call once with a "fix your JSON" prompt. If still bad, return raw text as `reply`. |
| Telegram send failure        | `bot.ts`       | Log error. Grammy handles retries internally.                                                    |
| Agent tool call fails        | `runner.ts`    | Pass error message back to LLM as tool_result with `is_error: true`. Let LLM decide next step.   |
| Unknown agent in invoke()    | `invoker.ts`   | Throw `UnknownAgentError`. Caller LLM receives error.                                            |

**General principle:** Agents should be resilient. Tool failures are reported back to the LLM which can retry, skip, or ask the user. The system should never crash from an agent error.

---

## 13. Implementation Order

Build and test each layer before moving to the next. Each step should be independently testable.

### Phase 1 — Foundation

1. **Project scaffold:** `package.json`, `tsconfig.json`, `docker-compose.yml`, `Dockerfile`, `.env.example`.
2. **Config loader:** `src/config/env.ts` with schema validation.
3. **Logger:** `src/utils/logger.ts` (pino).
4. **External clients:** Implement and test each independently:
   - `src/clients/qdrant.ts` — test against local Qdrant container.
   - `src/clients/paperless.ts` — test against local Paperless container.
   - `src/clients/anthropic.ts` — test with a simple prompt.
   - `src/clients/openai.ts` — test embedding a sentence.
5. **Text chunker:** `src/utils/chunker.ts` — unit test with known text.

### Phase 2 — Agent Runtime

6. **Types:** `src/runtime/types.ts`.
7. **Tool registry:** `src/tools/registry.ts`, `paperless.tool.ts`, `qdrant.tool.ts`.
8. **Agent registry:** `src/runtime/registry.ts` — load from `src/agents/`.
9. **Loop guard:** `src/runtime/loop-guard.ts`.
10. **Agent runner:** `src/runtime/runner.ts` — test with a single agent (Chatter) and mock LLM.
11. **Invoker:** `src/runtime/invoker.ts`.
12. **Tracing:** `src/tracing/trace.ts`, `src/tracing/store.ts`.

### Phase 3 — Agents

Implement agents in dependency order (leaf → root):

13. **Embedder** (custom runner, no LLM dependency).
14. **Searcher** (needs Qdrant + Paperless tools).
15. **Indexer** (needs Paperless tool + invokes Embedder).
16. **Form-Filler** (needs Searcher + Paperless tools, vision).
17. **Classifier** (needs to invoke all above).
18. **Chatter** (needs to invoke Classifier).

### Phase 4 — Telegram Bot

19. **Bot setup:** `src/bot/bot.ts`, custom context.
20. **Command handlers:** `/start`, `/list`, `/agents`.
21. **Message handler:** Wire text messages → Chatter.
22. **Document handler:** Wire file uploads → Chatter with files.
23. **Conversation history:** In-memory buffer per chat.

### Phase 5 — Integration & Polish

24. **End-to-end test:** Send a document via Telegram, verify it's indexed, then query it.
25. **Error handling pass:** Implement retries, timeouts, graceful degradation.
26. **Trace review:** Verify trace files are complete and readable.
27. **Docker Compose full test:** `docker compose up` from scratch, run through all four core flows.

---

## Appendix A: Tool Definitions for LLM Calls

When an agent has tools, the runner must convert them to Anthropic tool format. Here are the exact tool definitions to pass.

### `paperless` tools

```json
[
  {
    "name": "paperless_upload",
    "description": "Upload a document file to Paperless-ngx for storage and OCR.",
    "input_schema": {
      "type": "object",
      "properties": {
        "filePath": {
          "type": "string",
          "description": "Local path to the file"
        },
        "title": { "type": "string", "description": "Document title" },
        "tags": {
          "type": "array",
          "items": { "type": "string" },
          "description": "Tag names to apply"
        },
        "documentType": {
          "type": "string",
          "description": "Document type name"
        }
      },
      "required": ["filePath"]
    }
  },
  {
    "name": "paperless_get",
    "description": "Get document metadata and OCR text by document ID.",
    "input_schema": {
      "type": "object",
      "properties": {
        "documentId": {
          "type": "integer",
          "description": "Paperless document ID"
        }
      },
      "required": ["documentId"]
    }
  },
  {
    "name": "paperless_download",
    "description": "Download the original document file by ID.",
    "input_schema": {
      "type": "object",
      "properties": {
        "documentId": {
          "type": "integer",
          "description": "Paperless document ID"
        }
      },
      "required": ["documentId"]
    }
  },
  {
    "name": "paperless_search",
    "description": "Full-text search across all documents in Paperless.",
    "input_schema": {
      "type": "object",
      "properties": {
        "query": { "type": "string", "description": "Search query" },
        "limit": {
          "type": "integer",
          "description": "Max results",
          "default": 5
        }
      },
      "required": ["query"]
    }
  },
  {
    "name": "paperless_list",
    "description": "List all stored documents with pagination.",
    "input_schema": {
      "type": "object",
      "properties": {
        "page": { "type": "integer", "default": 1 },
        "pageSize": { "type": "integer", "default": 25 }
      }
    }
  },
  {
    "name": "paperless_update",
    "description": "Update a document's title, tags, or type.",
    "input_schema": {
      "type": "object",
      "properties": {
        "documentId": { "type": "integer" },
        "title": { "type": "string" },
        "tags": { "type": "array", "items": { "type": "string" } },
        "documentType": { "type": "string" }
      },
      "required": ["documentId"]
    }
  }
]
```

### `qdrant` tools

```json
[
  {
    "name": "qdrant_search",
    "description": "Semantic search over document embeddings. Provide a text query; it will be embedded and searched.",
    "input_schema": {
      "type": "object",
      "properties": {
        "query": {
          "type": "string",
          "description": "Natural language search query"
        },
        "limit": {
          "type": "integer",
          "description": "Max results",
          "default": 5
        },
        "documentType": {
          "type": "string",
          "description": "Optional filter by document type"
        }
      },
      "required": ["query"]
    }
  },
  {
    "name": "qdrant_upsert",
    "description": "Store document embeddings in the vector database.",
    "input_schema": {
      "type": "object",
      "properties": {
        "documentId": { "type": "string" },
        "text": {
          "type": "string",
          "description": "Full text to chunk and embed"
        },
        "metadata": {
          "type": "object",
          "description": "Additional metadata to store"
        }
      },
      "required": ["documentId", "text"]
    }
  }
]
```

Note: The `qdrant_search` tool handler internally calls the embedder (OpenAI) to convert the query text to a vector before searching. This is done inside `src/tools/qdrant.tool.ts`, not by the agent.

---

## Appendix B: Key Design Decisions

1. **Agents are peers, not a hierarchy.** Any agent can call any other agent. The Classifier is the primary router but not a gatekeeper. This enables the Form-Filler to directly call Searcher without going through the Classifier.

2. **Custom runners for non-LLM agents.** The Embedder doesn't need an LLM — it's pure API calls. Custom runners (`index.ts`) let agents bypass the default LLM+tool loop entirely.

3. **Post-LLM triggers instead of agent-as-tool.** Rather than exposing `invoke()` as an Anthropic tool (which adds complexity and token cost), the runner checks output flags like `triggerEmbedder` and makes the invocation after the LLM call completes.

4. **Qdrant search tool embeds the query internally.** Agents don't need to worry about embedding mechanics — they just pass a text query to `qdrant_search` and get results.

5. **Paperless-ngx handles OCR.** We don't run a separate OCR pipeline. Paperless handles it on upload. The Indexer reads OCR text from the Paperless API after the document is processed.

6. **In-memory conversation history.** No database for v1. Acceptable because this is a single-user self-hosted bot. If the bot restarts, history resets — documents are still in Paperless/Qdrant.

7. **File-based traces.** JSON files organized by date. Simple, greppable, no extra infrastructure. Can be upgraded to SQLite later if needed.
