import * as llm from "../services/llm.js";
import type { Classification } from "../types/document.js";

export async function classifyDocument(text: string): Promise<Classification> {
  return llm.classify(text);
}
