---

# PaperClaw — Node.js Implementation Guide

## 1. Architecture (Same as Before, Different Runtime)

```
┌─────────────────────────────────────────────────────────┐
│              Telegram / WhatsApp / Web UI                │
└────────────────────────┬────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────┐
│                 OpenClaw Gateway (Node.js)               │
│          messages → skill router → skills                │
└────────────────────────┬────────────────────────────────┘
                         │ direct import (same runtime!)
┌────────────────────────▼────────────────────────────────┐
│            PaperClaw Core (Fastify + TypeScript)         │
│                                                          │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │ Agent Router │  │ Ingestion    │  │ Scheduler     │  │
│  │ (Haiku)     │  │ Pipeline     │  │ (node-cron)   │  │
│  └──────┬──────┘  └──────┬───────┘  └───────────────┘  │
│         │                │                               │
│  ┌──────▼──────────────▼─────────────────────────┐     │
│  │            Shared Services                     │     │
│  │  Paperless Client (fetch) │ Qdrant (JS SDK)   │     │
│  │  Anthropic SDK            │ OpenAI SDK         │     │
│  │  pdf-lib (form filling)   │ pdf-parse (read)   │     │
│  └────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────┘
         │              │              │
  ┌──────▼──┐    ┌─────▼────┐   ┌────▼─────┐
  │Paperless│    │  Qdrant  │   │PostgreSQL│
  │  :8000  │    │  :6333   │   │  :5432   │
  └─────────┘    └──────────┘   └──────────┘
```


---

## 2. Tech Stack

| Role                | Package                           | Why                                             |
| ------------------- | --------------------------------- | ----------------------------------------------- |
| Web framework       | `fastify`                         | Faster than Express, built-in schema validation |
| Anthropic API       | `@anthropic-ai/sdk`               | Official SDK, full TypeScript types             |
| OpenAI (embeddings) | `openai`                          | For `text-embedding-3-small`                    |
| Vector search       | `@qdrant/js-client-rest`          | Official Qdrant JS client                       |
| Validation          | `zod`                             | Runtime type checking, pairs with Anthropic SDK |
| PDF read            | `pdf-parse`                       | Extract text from PDFs                          |
| PDF fill/create     | `pdf-lib`                         | Fill form fields, create PDFs, overlay text     |
| Scheduler           | `node-cron`                       | Cron-style scheduling for tax reminders         |
| HTTP client         | built-in `fetch`                  | Node 18+ has native fetch, no axios needed      |
| TypeScript          | `tsx`                             | Dev runner with hot reload                      |
| Process manager     | `node` (prod) / `tsx watch` (dev) | No extra tooling needed                         |

---

## 3. Project Structure

```
paperclaw/
├── docker-compose.yml
├── docker-compose.override.yml    # local dev: expose ports
├── .env.example
├── .env                           # secrets (gitignored)
├── .gitignore
├── README.md
│
├── core/                          # Node.js backend
│   ├── Dockerfile
│   ├── package.json
│   ├── tsconfig.json
│   │
│   └── src/
│       ├── index.ts               # Fastify entrypoint
│       ├── config.ts              # env vars via zod
│       │
│       ├── services/              # external service clients
│       │   ├── llm.ts             # Anthropic (Haiku+Sonnet) + OpenAI embeddings
│       │   ├── paperless.ts       # Paperless-ngx REST API client
│       │   ├── vectorstore.ts     # Qdrant client wrapper
│       │   └── scheduler.ts       # node-cron tax deadlines
│       │
│       ├── ingestion/             # document processing pipeline
│       │   ├── pipeline.ts        # upload → OCR → classify → extract → embed
│       │   ├── classifier.ts      # Haiku doc classification
│       │   ├── extractor.ts       # Haiku structured field extraction
│       │   └── chunker.ts         # text splitting for embeddings
│       │
│       ├── agents/                # domain AI agents
│       │   ├── base.ts            # abstract base agent class
│       │   ├── router.ts          # intent → agent routing
│       │   ├── gestor.ts          # Spain tax (autónomo)
│       │   ├── doctor.ts          # medical docs
│       │   └── id-docs.ts         # ID documents & form filling
│       │
│       ├── tools/                 # agent capabilities
│       │   ├── pdf-filler.ts      # fill PDF forms with pdf-lib
│       │   ├── pdf-generator.ts   # create PDF reports/summaries
│       │   └── tax-calculator.ts  # IVA/IRPF computation
│       │
│       ├── routes/                # Fastify route handlers
│       │   ├── ingest.ts          # POST /ingest
│       │   ├── query.ts           # POST /query
│       │   ├── deadlines.ts       # GET /deadlines
│       │   └── health.ts          # GET /health
│       │
│       └── types/                 # shared TypeScript types
│           ├── document.ts        # document metadata
│           ├── agent.ts           # agent request/response
│           └── tax.ts             # Spain tax models
│
├── skills/                        # OpenClaw skills (thin wrappers)
│   ├── paperclaw-ingest/
│   │   ├── skill.json
│   │   └── handler.ts
│   ├── paperclaw-query/
│   │   ├── skill.json
│   │   └── handler.ts
│   └── paperclaw-status/
│       ├── skill.json
│       └── handler.ts
│
├── scripts/
│   ├── setup-vps.sh               # VPS initial setup
│   ├── setup-paperless.ts         # create tags & custom fields
│   └── backup.sh                  # daily backup cron
│
└── data/                          # persistent volumes (gitignored)
    ├── postgres/
    ├── paperless/
    ├── qdrant/
    └── openclaw/
```

---

## 4. Key Implementation Patterns (Node.js / TypeScript)

### 4.1 Config (Zod validated)

```typescript
// src/config.ts
import { z } from "zod";

const envSchema = z.object({
  PAPERLESS_URL: z.string().default("http://paperless:8000"),
  PAPERLESS_TOKEN: z.string(),
  QDRANT_URL: z.string().default("http://qdrant:6333"),
  ANTHROPIC_API_KEY: z.string(),
  OPENAI_API_KEY: z.string(),
  MODEL_FAST: z.string().default("claude-haiku-4-5-20251001"),
  MODEL_SMART: z.string().default("claude-sonnet-4-20250514"),
  EMBEDDING_MODEL: z.string().default("text-embedding-3-small"),
  PORT: z.coerce.number().default(8080),
});

export const config = envSchema.parse(process.env);
export type Config = z.infer<typeof envSchema>;
```

### 4.2 LLM Service

```typescript
// src/services/llm.ts
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { config } from "../config.js";

const anthropic = new Anthropic({ apiKey: config.ANTHROPIC_API_KEY });
const openai = new OpenAI({ apiKey: config.OPENAI_API_KEY });

export async function classify(text: string): Promise<Classification> {
  const response = await anthropic.messages.create({
    model: config.MODEL_FAST,
    max_tokens: 500,
    system: `You are a document classifier. Return ONLY JSON:
      {"doc_type": "receipt"|"invoice"|"medical_report"|"id_document"|...,
       "agent": "gestor"|"doctor"|"id_docs",
       "confidence": 0.0-1.0}`,
    messages: [{ role: "user", content: text }],
  });
  return JSON.parse(
    response.content[0].type === "text" ? response.content[0].text : "{}",
  );
}

export async function extractFields(text: string, docType: string) {
  // Same pattern: Haiku + schema prompt → JSON
}

export async function reason(
  systemPrompt: string,
  userMessage: string,
  contextDocs: string[],
): Promise<string> {
  const context = contextDocs.join("\n\n---\n\n") || "No documents found.";
  const response = await anthropic.messages.create({
    model: config.MODEL_SMART,
    max_tokens: 2000,
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content: `Context documents:\n${context}\n\nUser question: ${userMessage}`,
      },
    ],
  });
  return response.content[0].type === "text" ? response.content[0].text : "";
}

export async function embed(texts: string[]): Promise<number[][]> {
  const response = await openai.embeddings.create({
    model: config.EMBEDDING_MODEL,
    input: texts,
  });
  return response.data.map((item) => item.embedding);
}
```

### 4.3 Qdrant Vector Store

```typescript
// src/services/vectorstore.ts
import { QdrantClient } from "@qdrant/js-client-rest";
import crypto from "crypto";
import { config } from "../config.js";

const client = new QdrantClient({ url: config.QDRANT_URL });
const COLLECTION = "paperclaw_docs";

export async function ensureCollection() {
  const collections = await client.getCollections();
  const exists = collections.collections.some((c) => c.name === COLLECTION);
  if (!exists) {
    await client.createCollection(COLLECTION, {
      vectors: { size: 1536, distance: "Cosine" },
    });
  }
}

export async function upsertDocument(
  paperlessId: number,
  chunks: string[],
  embeddings: number[][],
  metadata: { agent: string; docType: string; year: string; quarter: string },
) {
  const points = chunks.map((chunk, i) => ({
    id: crypto.createHash("md5").update(`${paperlessId}_${i}`).digest("hex"),
    vector: embeddings[i],
    payload: {
      paperless_id: paperlessId,
      chunk_index: i,
      text: chunk,
      ...metadata,
    },
  }));
  await client.upsert(COLLECTION, { points });
}

export async function search(
  queryEmbedding: number[],
  filters?: { agent?: string; docType?: string },
  limit = 8,
) {
  const must: any[] = [];
  if (filters?.agent) {
    must.push({ key: "agent", match: { value: filters.agent } });
  }
  if (filters?.docType) {
    must.push({ key: "docType", match: { value: filters.docType } });
  }

  const results = await client.query(COLLECTION, {
    query: queryEmbedding,
    filter: must.length ? { must } : undefined,
    limit,
    with_payload: true,
  });

  return results.map((r) => ({
    text: (r.payload as any).text as string,
    paperlessId: (r.payload as any).paperless_id as number,
    score: r.score,
  }));
}
```

### 4.4 PDF Form Filling (the key differentiator)

```typescript
// src/tools/pdf-filler.ts
import { PDFDocument } from "pdf-lib";

export async function fillPdfForm(
  pdfBytes: Buffer,
  fieldData: Record<string, string>,
): Promise<Buffer> {
  const pdf = await PDFDocument.load(pdfBytes);
  const form = pdf.getForm();

  const filled: string[] = [];
  const missing: string[] = [];

  // List all fields in the form
  const fields = form.getFields();

  for (const field of fields) {
    const name = field.getName();
    const value = fieldData[name];
    if (value && field.constructor.name === "PDFTextField") {
      (field as any).setText(value);
      filled.push(name);
    } else if (!value) {
      missing.push(name);
    }
  }

  const resultBytes = await pdf.save();
  return Buffer.from(resultBytes);
}

export async function listFormFields(pdfBytes: Buffer): Promise<string[]> {
  const pdf = await PDFDocument.load(pdfBytes);
  const form = pdf.getForm();
  return form.getFields().map((f) => `${f.getName()} (${f.constructor.name})`);
}

export async function generatePdfReport(
  title: string,
  sections: { heading: string; body: string }[],
): Promise<Buffer> {
  // Use pdf-lib to create a new PDF from scratch
  const pdf = await PDFDocument.create();
  const page = pdf.addPage();
  const { height } = page.getSize();

  // Simple text layout — for complex reports, consider @react-pdf/renderer
  let y = height - 50;
  page.drawText(title, { x: 50, y, size: 18 });
  y -= 30;

  for (const section of sections) {
    page.drawText(section.heading, { x: 50, y, size: 14 });
    y -= 20;
    // Word-wrap body text (simplified)
    const lines = section.body.match(/.{1,80}/g) || [];
    for (const line of lines) {
      if (y < 50) {
        // new page
        const newPage = pdf.addPage();
        y = newPage.getSize().height - 50;
        newPage.drawText(line, { x: 50, y, size: 11 });
      } else {
        page.drawText(line, { x: 50, y, size: 11 });
      }
      y -= 16;
    }
    y -= 10;
  }

  return Buffer.from(await pdf.save());
}
```

### 4.5 Agent Interaction Flow (How the User Talks to Experts)

```typescript
// src/agents/base.ts
import * as llm from "../services/llm.js";
import * as vectorstore from "../services/vectorstore.js";

export interface AgentResponse {
  agent: string;
  text: string;
  attachments?: { filename: string; buffer: Buffer; mimeType: string }[];
}

export abstract class BaseAgent {
  abstract name: string;
  abstract systemPrompt: string;
  abstract docFilter: { agent?: string; docType?: string };

  async answer(message: string, fileBuffer?: Buffer): Promise<AgentResponse> {
    // 1. If user sent a file (PDF form to fill), handle it
    if (fileBuffer) {
      return this.handleFile(message, fileBuffer);
    }

    // 2. Embed the question
    const [queryEmbedding] = await llm.embed([message]);

    // 3. Retrieve relevant docs
    const results = await vectorstore.search(queryEmbedding, this.docFilter);
    const contextDocs = results.map((r) => r.text);

    // 4. Reason with Sonnet
    const text = await llm.reason(this.systemPrompt, message, contextDocs);

    return { agent: this.name, text };
  }

  // Override in subclasses for PDF generation, form filling, etc.
  async handleFile(
    message: string,
    fileBuffer: Buffer,
  ): Promise<AgentResponse> {
    return { agent: this.name, text: "File received but no handler defined." };
  }
}
```

```typescript
// src/agents/gestor.ts — example of agent that returns PDFs
import { BaseAgent, AgentResponse } from "./base.js";
import { fillPdfForm, listFormFields } from "../tools/pdf-filler.js";
import { extractFields } from "../services/llm.js";
import * as paperless from "../services/paperless.js";

export class GestorAgent extends BaseAgent {
  name = "gestor";
  systemPrompt = `You are a Spanish tax assistant for autónomos...`; // same as before
  docFilter = { agent: "gestor" };

  async handleFile(
    message: string,
    fileBuffer: Buffer,
  ): Promise<AgentResponse> {
    // User sent a PDF form — try to fill it
    const fields = await listFormFields(fileBuffer);

    // Get all relevant data from Paperless
    const taxData = await this.gatherTaxData();

    // Use Haiku to map form fields → tax data
    const mapping = await this.mapFieldsToData(fields, taxData);

    // Fill the PDF
    const filledPdf = await fillPdfForm(fileBuffer, mapping);

    return {
      agent: this.name,
      text:
        `Modelo filled with Q${this.currentQuarter()} data.\n` +
        `Filled: ${Object.keys(mapping).length} fields.\n` +
        `Please review before submitting to AEAT.`,
      attachments: [
        {
          filename: `Modelo_filled_Q${this.currentQuarter()}_${new Date().getFullYear()}.pdf`,
          buffer: filledPdf,
          mimeType: "application/pdf",
        },
      ],
    };
  }

  private currentQuarter(): number {
    return Math.ceil((new Date().getMonth() + 1) / 3);
  }

  private async gatherTaxData() {
    /* query Paperless for Q receipts/invoices */
  }
  private async mapFieldsToData(fields: string[], data: any) {
    /* Haiku maps */
  }
}
```

### 4.6 How the Response Gets Back to You (Telegram)

```
You send photo of receipt via Telegram
  → OpenClaw receives it
  → OpenClaw calls paperclaw-ingest skill
  → Skill calls your core service POST /ingest
  → Pipeline: upload to Paperless → OCR → classify (Haiku) → extract → embed
  → Response: "Receipt from Amazon, €45.99, tagged as deducible Q1"

You type "fill this form" + attach Modelo 303 PDF
  → OpenClaw calls paperclaw-query skill with file
  → Skill calls POST /query with { agent: "gestor", message, file }
  → Gestor agent: reads form fields → gathers data → fills PDF
  → Response: text summary + filled PDF attachment
  → OpenClaw sends filled PDF back through Telegram

You type "what medications am I taking?"
  → OpenClaw auto-routes to doctor skill
  → Skill calls POST /query { agent: "auto", message }
  → Router classifies → doctor agent
  → Doctor agent: embeds question → searches medical docs → Sonnet reasons
  → Response: plain text answer with medication list and interaction warnings
```

---

## 5. Docker Compose

```yaml
# The Dockerfile changes — everything else stays identical
paperclaw-core:
  build:
    context: ./core
    dockerfile: Dockerfile
  restart: unless-stopped
  depends_on:
    - paperless
    - qdrant
  ports:
    - "127.0.0.1:8080:8080"
  environment:
    PAPERLESS_URL: http://paperless:8000
    PAPERLESS_TOKEN: ${PAPERLESS_TOKEN}
    QDRANT_URL: http://qdrant:6333
    ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}
    OPENAI_API_KEY: ${OPENAI_API_KEY}
  mem_limit: 200m
```

```dockerfile
# core/Dockerfile
FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --production
COPY dist/ ./dist/
EXPOSE 8080
CMD ["node", "dist/index.js"]
```

Note: you build TypeScript locally (`npm run build`) and deploy the `dist/` folder. Or use a multi-stage Docker build.

---

## 6. package.json

```json
{
  "name": "paperclaw-core",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "setup-paperless": "tsx scripts/setup-paperless.ts"
  },
  "dependencies": {
    "@anthropic-ai/sdk": "^0.52.0",
    "@qdrant/js-client-rest": "^1.16.0",
    "fastify": "^5.0.0",
    "@fastify/multipart": "^9.0.0",
    "openai": "^4.80.0",
    "pdf-lib": "^1.17.1",
    "pdf-parse": "^1.1.1",
    "node-cron": "^3.0.3",
    "zod": "^3.24.0",
    "dotenv": "^16.4.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "@types/pdf-parse": "^1.1.4",
    "@types/node-cron": "^3.0.11",
    "tsx": "^4.19.0",
    "typescript": "^5.7.0"
  }
}
```

---

## 7. Development Workflow

### Local Development

```bash
# 1. Clone your repo
git clone git@github.com:you/paperclaw.git
cd paperclaw

# 2. Setup env
cp .env.example .env
# Fill in ANTHROPIC_API_KEY, OPENAI_API_KEY, passwords

# 3. Start infrastructure
docker compose --profile infra up -d
# Wait ~60s for Paperless to boot

# 4. Configure Paperless
# Visit http://localhost:8000, create admin, copy API token
# Add PAPERLESS_TOKEN to .env
cd core && npm install
npm run setup-paperless

# 5. Develop with hot reload
npm run dev
# Core runs at http://localhost:8080

# 6. Test
curl -X POST http://localhost:8080/ingest -F "file=@receipt.pdf"
curl -X POST http://localhost:8080/query \
  -H "Content-Type: application/json" \
  -d '{"message": "how much IVA this quarter?"}'
```

### Push to GitHub

```bash
git add .
git commit -m "feat: gestor agent with form filling"
git push origin main
```

### Deploy to VPS (Pull from GitHub)

```bash
# ONE-TIME VPS SETUP (as root):
bash scripts/setup-vps.sh
# This creates paperclaw user, installs Docker, sets up swap, Caddy

# AS paperclaw user on VPS:
cd ~
git clone git@github.com:you/paperclaw.git
cd paperclaw

# Copy secrets (do this once, manually)
nano .env  # paste your production .env

# Build and start
cd core && npm ci && npm run build && cd ..
docker compose --profile full up -d

# SUBSEQUENT DEPLOYS (from VPS):
cd ~/paperclaw
git pull origin main
cd core && npm ci && npm run build && cd ..
docker compose --profile full up -d --build paperclaw-core
```

Or automate it:

```bash
# scripts/deploy-on-vps.sh — run ON the VPS
#!/bin/bash
set -euo pipefail
cd ~/paperclaw
git pull origin main
cd core && npm ci && npm run build && cd ..
docker compose --profile full build paperclaw-core
docker compose --profile full up -d
docker compose --profile full ps
```

Then from your local machine: `ssh paperclaw@your-vps 'bash ~/paperclaw/scripts/deploy-on-vps.sh'`

---

## 8. Interaction Summary

| You do...                        | Agent does...                        | Returns...                           |
| -------------------------------- | ------------------------------------ | ------------------------------------ |
| Send receipt photo               | Classify → extract → tag → embed     | Text summary of what was stored      |
| Send PDF form + "fill this"      | Read fields → gather data → fill     | **Filled PDF file** + summary        |
| Ask "cuánto IVA?"                | Search receipts → calculate → reason | Text answer with numbers             |
| Ask "my medications?"            | Search medical docs → summarize      | Text answer with timeline            |
| Ask "prepare Q1 declaration"     | Aggregate all Q1 data → generate     | **PDF report** with totals           |
| Ask "fill empadronamiento" + PDF | Match ID data to fields → fill       | **Filled PDF** + missing fields list |
| Nothing (deadline approaching)   | Scheduler triggers proactively       | **Push notification** via Telegram   |

---

## 9. VPS Final Checklist

```
[ ] Ubuntu 24.04, 4GB RAM, 2 cores, 40GB disk
[ ] Run setup-vps.sh (Docker, swap, Caddy, paperclaw user)
[ ] DNS: paperclaw.yourdomain.com → VPS IP
[ ] git clone on VPS
[ ] Create .env on VPS with production secrets
[ ] npm ci && npm run build in core/
[ ] docker compose --profile full up -d
[ ] Configure OpenClaw: docker compose exec openclaw node dist/index.js setup
[ ] Connect Telegram bot
[ ] Run setup-paperless.ts to create tags/fields
[ ] Test: send receipt via Telegram
[ ] Setup crontab for backup.sh
```
