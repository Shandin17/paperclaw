import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { config } from "../config.js";
import type { Classification, ExtractedFields } from "../types/document.js";

const anthropic = new Anthropic({ apiKey: config.ANTHROPIC_API_KEY });
const openai = new OpenAI({ apiKey: config.OPENAI_API_KEY });

export async function classify(text: string): Promise<Classification> {
  const response = await anthropic.messages.create({
    model: config.MODEL_FAST,
    max_tokens: 500,
    system: `You are a document classifier. Analyze the document text and return ONLY valid JSON:
{"doc_type": "receipt"|"invoice"|"medical_report"|"prescription"|"lab_result"|"id_document"|"contract"|"tax_form"|"bank_statement"|"other",
 "agent": "gestor"|"doctor"|"id_docs"|"general",
 "confidence": 0.0-1.0}

Rules:
- receipts/invoices → gestor
- medical_report/prescription/lab_result → doctor
- id_document → id_docs
- Everything else → general`,
    messages: [{ role: "user", content: text.slice(0, 4000) }],
  });

  const raw = response.content[0].type === "text" ? response.content[0].text : "{}";
  try {
    return JSON.parse(raw) as Classification;
  } catch {
    return { doc_type: "other", agent: "general", confidence: 0.5 };
  }
}

export async function extractFields(text: string, docType: string): Promise<ExtractedFields> {
  const response = await anthropic.messages.create({
    model: config.MODEL_FAST,
    max_tokens: 800,
    system: `You are a structured data extractor for ${docType} documents. Return ONLY valid JSON with these fields (omit if not found):
{
  "amount": "total amount as string",
  "currency": "EUR|USD|...",
  "vendor": "vendor/provider name",
  "date": "YYYY-MM-DD",
  "iva_rate": "21|10|4|0",
  "iva_amount": "IVA/VAT amount",
  "irpf_rate": "15|7|...",
  "description": "brief description"
}`,
    messages: [{ role: "user", content: text.slice(0, 4000) }],
  });

  const raw = response.content[0].type === "text" ? response.content[0].text : "{}";
  try {
    return JSON.parse(raw) as ExtractedFields;
  } catch {
    return {};
  }
}

export async function reason(
  systemPrompt: string,
  userMessage: string,
  contextDocs: string[],
): Promise<string> {
  const context = contextDocs.length > 0
    ? contextDocs.join("\n\n---\n\n")
    : "No documents found.";

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

export async function mapFieldsToData(
  fields: string[],
  data: Record<string, string>,
): Promise<Record<string, string>> {
  const response = await anthropic.messages.create({
    model: config.MODEL_FAST,
    max_tokens: 1000,
    system: `You map PDF form field names to data values. Return ONLY valid JSON mapping field names to values.
Only include fields where you have confident data. Use exact field names from the input.`,
    messages: [
      {
        role: "user",
        content: `Form fields:\n${fields.join("\n")}\n\nAvailable data:\n${JSON.stringify(data, null, 2)}`,
      },
    ],
  });

  const raw = response.content[0].type === "text" ? response.content[0].text : "{}";
  try {
    return JSON.parse(raw) as Record<string, string>;
  } catch {
    return {};
  }
}

export async function embed(texts: string[]): Promise<number[][]> {
  const response = await openai.embeddings.create({
    model: config.EMBEDDING_MODEL,
    input: texts,
  });
  return response.data.map((item) => item.embedding);
}
