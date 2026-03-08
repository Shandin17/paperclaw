#!/usr/bin/env tsx
/**
 * Setup Paperless-ngx with PaperClaw tags and custom fields.
 * Run once after Paperless is up: npm run setup-paperless
 */

import "dotenv/config";
import { ensureTag, ensureCustomField } from "../src/services/paperless.js";

const TAGS = [
  // Agent tags
  "gestor",
  "doctor",
  "id_docs",
  "general",
  // Document type tags
  "receipt",
  "invoice",
  "medical_report",
  "prescription",
  "lab_result",
  "id_document",
  "contract",
  "tax_form",
  "bank_statement",
  // Time tags (Q1-Q4 are created dynamically, but ensure current year)
  `Q1-${new Date().getFullYear()}`,
  `Q2-${new Date().getFullYear()}`,
  `Q3-${new Date().getFullYear()}`,
  `Q4-${new Date().getFullYear()}`,
  // Status tags
  "deducible",
  "no-deducible",
  "pending-review",
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
  console.log("Setting up Paperless-ngx for PaperClaw...\n");

  console.log("Creating tags...");
  for (const tag of TAGS) {
    const id = await ensureTag(tag);
    console.log(`  ✓ Tag: ${tag} (id: ${id})`);
  }

  console.log("\nCreating custom fields...");
  for (const field of CUSTOM_FIELDS) {
    try {
      const id = await ensureCustomField(field.name, field.dataType);
      console.log(`  ✓ Field: ${field.name} (id: ${id})`);
    } catch (err) {
      // monetary/integer types may not be supported in all versions, fall back to string
      const id = await ensureCustomField(field.name, "string");
      console.log(`  ✓ Field: ${field.name} (id: ${id}, type: string fallback)`);
    }
  }

  console.log("\n✅ Paperless-ngx setup complete!");
}

setup().catch((err) => {
  console.error("Setup failed:", err);
  process.exit(1);
});
