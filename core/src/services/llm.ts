import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { config } from '../config.js';
import type { Classification, ExtractedFields } from '../types/document.js';

const anthropic = new Anthropic({ apiKey: config.ANTHROPIC_API_KEY });
const openai = new OpenAI({ apiKey: config.OPENAI_API_KEY });

// ─── Classification (Haiku — cheap & fast) ───────────────

export async function classify(text: string): Promise<Classification> {
  const response = await anthropic.messages.create({
    model: config.MODEL_FAST,
    max_tokens: 500,
    system: `You are a document classifier. Given OCR text, return ONLY a JSON object:
{
  "doc_type": "receipt" | "invoice" | "medical_report" | "id_document" | "tax_form" | "bank_statement" | "contract" | "other",
  "agent": "gestor" | "doctor" | "id_docs",
  "language": "es" | "en" | "other",
  "confidence": 0.0 to 1.0
}
No explanation. Just valid JSON.`,
    messages: [{ role: 'user', content: text.slice(0, 4000) }],
  });

  const raw = response.content[0];
  try {
    return JSON.parse(raw.type === 'text' ? raw.text : '{}');
  } catch {
    return { doc_type: 'other', agent: 'gestor', language: 'unknown', confidence: 0 };
  }
}

// ─── Field Extraction (Haiku) ────────────────────────────

const EXTRACTION_SCHEMAS: Record<string, string> = {
  receipt: `{"vendor":string,"date":"YYYY-MM-DD","total":number,"iva_amount":number,"iva_rate":number,"items":[string],"payment_method":string,"nif_vendor":string}`,
  invoice: `{"vendor":string,"client":string,"date":"YYYY-MM-DD","invoice_number":string,"base_amount":number,"iva_amount":number,"iva_rate":number,"total":number,"nif_vendor":string,"nif_client":string,"irpf_retention":number}`,
  medical_report: `{"provider":string,"date":"YYYY-MM-DD","patient_name":string,"diagnosis":[string],"medications":[string],"specialist":string,"next_appointment":string,"amount":number}`,
  id_document: `{"document_type":string,"full_name":string,"date_of_birth":"YYYY-MM-DD","document_number":string,"expiry_date":"YYYY-MM-DD","nationality":string,"address":string}`,
};

export async function extractFields(
  text: string,
  docType: string,
): Promise<ExtractedFields> {
  const schema = EXTRACTION_SCHEMAS[docType] ?? 'Extract all key fields as JSON.';

  const response = await anthropic.messages.create({
    model: config.MODEL_FAST,
    max_tokens: 1000,
    system: `You extract structured data from documents. Return ONLY valid JSON matching:\n${schema}`,
    messages: [{ role: 'user', content: `Document text:\n\n${text.slice(0, 4000)}` }],
  });

  const raw = response.content[0];
  try {
    return JSON.parse(raw.type === 'text' ? raw.text : '{}');
  } catch {
    return { raw: raw.type === 'text' ? raw.text : '' };
  }
}

// ─── Reasoning (Sonnet — smart) ──────────────────────────

export async function reason(
  systemPrompt: string,
  userMessage: string,
  contextDocs: string[],
): Promise<string> {
  const context = contextDocs.length > 0
    ? contextDocs.join('\n\n---\n\n')
    : 'No relevant documents found.';

  const response = await anthropic.messages.create({
    model: config.MODEL_SMART,
    max_tokens: 2000,
    system: systemPrompt,
    messages: [{
      role: 'user',
      content: `Context documents:\n${context}\n\nUser question: ${userMessage}`,
    }],
  });

  const raw = response.content[0];
  return raw.type === 'text' ? raw.text : '';
}

// ─── Intent Classification (Haiku) ──────────────────────

export async function classifyIntent(message: string): Promise<string> {
  const response = await anthropic.messages.create({
    model: config.MODEL_FAST,
    max_tokens: 50,
    system: `Classify this message to one agent:
- gestor: tax, invoices, receipts, expenses, IVA, IRPF, declarations, factura, gasto
- doctor: medical, health, diagnosis, medication, symptoms, doctors, médico
- id_docs: personal documents, ID, passport, forms, personal data, NIE, DNI
Return ONLY the agent name.`,
    messages: [{ role: 'user', content: message }],
  });

  const raw = response.content[0];
  const result = (raw.type === 'text' ? raw.text : '').trim().toLowerCase();
  return ['gestor', 'doctor', 'id_docs'].includes(result) ? result : 'gestor';
}

// ─── Form Field Mapping (Haiku) ─────────────────────────

export async function mapFormFields(
  fieldNames: string[],
  availableData: Record<string, string>,
): Promise<Record<string, string>> {
  const response = await anthropic.messages.create({
    model: config.MODEL_FAST,
    max_tokens: 2000,
    system: `You map PDF form field names to available data values.
Return ONLY a JSON object where keys are field names and values are the data to fill.
Skip fields that have no matching data. Be precise with dates and numbers.`,
    messages: [{
      role: 'user',
      content: `Form fields:\n${JSON.stringify(fieldNames)}\n\nAvailable data:\n${JSON.stringify(availableData)}`,
    }],
  });

  const raw = response.content[0];
  try {
    return JSON.parse(raw.type === 'text' ? raw.text : '{}');
  } catch {
    return {};
  }
}

// ─── Embeddings (OpenAI) ────────────────────────────────

export async function embed(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const response = await openai.embeddings.create({
    model: config.EMBEDDING_MODEL,
    input: texts,
  });
  return response.data.map((item) => item.embedding);
}
