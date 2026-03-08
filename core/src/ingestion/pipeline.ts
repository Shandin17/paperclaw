import pdfParse from "pdf-parse";
import * as paperless from "../services/paperless.js";
import * as vectorstore from "../services/vectorstore.js";
import * as llm from "../services/llm.js";
import { classifyDocument } from "./classifier.js";
import { extractDocumentFields, deriveQuarter } from "./extractor.js";
import { chunkText } from "./chunker.js";
import type { DocumentMetadata } from "../types/document.js";

export interface IngestResult {
  paperlessId: number;
  docType: string;
  agent: string;
  extractedFields: Record<string, string | undefined>;
  summary: string;
}

export async function ingestDocument(
  fileBuffer: Buffer,
  filename: string,
  mimeType: string,
): Promise<IngestResult> {
  // 1. Upload to Paperless for storage + OCR
  console.log(`Ingesting: ${filename}`);
  const paperlessId = await paperless.uploadDocument(fileBuffer, filename, mimeType);

  // 2. Get OCR'd content from Paperless
  const doc = await paperless.getDocument(paperlessId);
  let text = doc.content;

  // 3. Fallback: parse PDF directly if Paperless content is empty
  if (!text && mimeType === "application/pdf") {
    const parsed = await pdfParse(fileBuffer);
    text = parsed.text;
  }

  if (!text) throw new Error("No text content could be extracted from document");

  // 4. Classify
  const classification = await classifyDocument(text);
  console.log(`Classified as: ${classification.doc_type} (agent: ${classification.agent})`);

  // 5. Extract structured fields
  const fields = await extractDocumentFields(text, classification.doc_type);

  // 6. Determine time metadata
  const { year, quarter } = deriveQuarter(fields.date ?? "");

  // 7. Update Paperless with tags and metadata
  const tagId = await paperless.ensureTag(classification.agent);
  const docTypeTagId = await paperless.ensureTag(classification.doc_type);
  const quarterTagId = await paperless.ensureTag(`Q${quarter}-${year}`);

  await paperless.updateDocument(paperlessId, {
    title: fields.vendor
      ? `${fields.vendor} - ${classification.doc_type} - ${fields.date ?? year}`
      : filename,
    tags: [tagId, docTypeTagId, quarterTagId],
  });

  // 8. Chunk text and embed
  const chunks = chunkText(text);
  const embeddings = await llm.embed(chunks);

  // 9. Store in Qdrant
  await vectorstore.upsertDocument(paperlessId, chunks, embeddings, {
    agent: classification.agent,
    docType: classification.doc_type,
    year,
    quarter,
  });

  // 10. Generate summary
  const summary = await llm.reason(
    "Summarize this document in 2-3 sentences, highlighting key facts (amounts, dates, parties involved).",
    "Summarize this document.",
    [text.slice(0, 2000)],
  );

  return {
    paperlessId,
    docType: classification.doc_type,
    agent: classification.agent,
    extractedFields: fields,
    summary,
  };
}
