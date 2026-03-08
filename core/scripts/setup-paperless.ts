#!/usr/bin/env tsx
/**
 * Setup Paperless-ngx with PaperClaw tags and custom fields.
 * Run once after Paperless is up: npm run setup-paperless
 */

import { config } from "dotenv";
import { resolve } from "path";

// Load .env from repo root
config({ path: resolve(process.cwd(), "../.env") });
// Also try cwd (in case user runs from repo root)
config({ path: resolve(process.cwd(), ".env") });

const PAPERLESS_URL = process.env.PAPERLESS_URL ?? "http://localhost:8000";
const PAPERLESS_TOKEN = process.env.PAPERLESS_TOKEN;

if (!PAPERLESS_TOKEN) {
  console.error("❌ PAPERLESS_TOKEN is not set in .env");
  process.exit(1);
}

function headers(): Record<string, string> {
  return {
    Authorization: `Token ${PAPERLESS_TOKEN}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

async function ensureTag(name: string): Promise<number> {
  const res = await fetch(`${PAPERLESS_URL}/api/tags/?page_size=200`, { headers: headers() });
  const data = await res.json() as { results: { id: number; name: string }[] };
  const existing = data.results.find((t) => t.name === name);
  if (existing) return existing.id;

  const create = await fetch(`${PAPERLESS_URL}/api/tags/`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ name }),
  });
  const created = await create.json() as { id: number };
  return created.id;
}

async function ensureCustomField(name: string, dataType: string): Promise<number> {
  const res = await fetch(`${PAPERLESS_URL}/api/custom_fields/?page_size=200`, { headers: headers() });
  const data = await res.json() as { results: { id: number; name: string }[] };
  const existing = data.results.find((f) => f.name === name);
  if (existing) return existing.id;

  const create = await fetch(`${PAPERLESS_URL}/api/custom_fields/`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ name, data_type: dataType }),
  });
  if (!create.ok) {
    // Fallback to string if type not supported
    const fallback = await fetch(`${PAPERLESS_URL}/api/custom_fields/`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ name, data_type: "string" }),
    });
    const created = await fallback.json() as { id: number };
    return created.id;
  }
  const created = await create.json() as { id: number };
  return created.id;
}

const TAGS = [
  "gestor", "doctor", "id_docs", "general",
  "receipt", "invoice", "medical_report", "prescription",
  "lab_result", "id_document", "contract", "tax_form", "bank_statement",
  `Q1-${new Date().getFullYear()}`,
  `Q2-${new Date().getFullYear()}`,
  `Q3-${new Date().getFullYear()}`,
  `Q4-${new Date().getFullYear()}`,
  "deducible", "no-deducible", "pending-review",
];

const CUSTOM_FIELDS = [
  { name: "doc_type", dataType: "string" },
  { name: "agent", dataType: "string" },
  { name: "amount", dataType: "monetary" },
  { name: "currency", dataType: "string" },
  { name: "vendor", dataType: "string" },
  { name: "iva_rate", dataType: "string" },
  { name: "iva_amount", dataType: "monetary" },
  { name: "irpf_rate", dataType: "string" },
  { name: "quarter", dataType: "string" },
  { name: "fiscal_year", dataType: "integer" },
];

async function setup(): Promise<void> {
  console.log(`Setting up Paperless-ngx at ${PAPERLESS_URL}...\n`);

  console.log("Creating tags...");
  for (const tag of TAGS) {
    const id = await ensureTag(tag);
    console.log(`  ✓ ${tag} (id: ${id})`);
  }

  console.log("\nCreating custom fields...");
  for (const field of CUSTOM_FIELDS) {
    const id = await ensureCustomField(field.name, field.dataType);
    console.log(`  ✓ ${field.name} (id: ${id})`);
  }

  console.log("\n✅ Paperless-ngx setup complete!");
}

setup().catch((err) => {
  console.error("Setup failed:", err);
  process.exit(1);
});
