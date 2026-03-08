import * as llm from "../services/llm.js";
import type { ExtractedFields } from "../types/document.js";

export async function extractDocumentFields(
  text: string,
  docType: string,
): Promise<ExtractedFields> {
  return llm.extractFields(text, docType);
}

export function deriveQuarter(dateStr: string): { year: string; quarter: string } {
  const date = dateStr ? new Date(dateStr) : new Date();
  const year = date.getFullYear().toString();
  const quarter = Math.ceil((date.getMonth() + 1) / 3).toString();
  return { year, quarter };
}
