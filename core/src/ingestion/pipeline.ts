import * as llm from '../services/llm.js';
import * as paperless from '../services/paperless.js';
import * as vectorstore from '../services/vectorstore.js';
import { chunkText } from './chunker.js';
import type { IngestResult } from '../types/document.js';

/**
 * Full ingestion pipeline:
 * Upload → OCR (Paperless) → Classify (Haiku) → Extract (Haiku) → Tag → Embed → Store
 */
export async function ingestDocument(
  fileBuffer: Buffer,
  fileName: string,
): Promise<IngestResult> {
  // Step 1: Upload to Paperless (handles OCR)
  console.log(`[ingest] Uploading ${fileName} to Paperless...`);
  const taskId = await paperless.uploadDocument(fileBuffer, fileName);

  // Step 2: Wait for OCR processing
  console.log(`[ingest] Waiting for Paperless to process (task: ${taskId})...`);
  const paperlessId = await paperless.waitForTask(taskId);
  console.log(`[ingest] Document stored as Paperless #${paperlessId}`);

  // Step 3: Get OCR'd text
  const text = await paperless.getDocumentText(paperlessId);
  console.log(`[ingest] Got ${text.length} chars of text`);

  // Step 4: Classify with Haiku
  const classification = await llm.classify(text);
  console.log(`[ingest] Classified: ${classification.doc_type} → ${classification.agent} (${classification.confidence})`);

  // Step 5: Extract structured fields with Haiku
  const extractedFields = await llm.extractFields(text, classification.doc_type);
  console.log(`[ingest] Extracted ${Object.keys(extractedFields).length} fields`);

  // Step 6: Tag in Paperless
  await tagDocument(paperlessId, classification);

  // Step 7: Chunk and embed
  const chunks = chunkText(text);
  const embeddings = await llm.embed(chunks);

  // Step 8: Store in vector DB
  const now = new Date();
  const quarter = `q${Math.ceil((now.getMonth() + 1) / 3)}`;
  await vectorstore.upsertDocument(paperlessId, chunks, embeddings, {
    agent: classification.agent,
    docType: classification.doc_type,
    year: String(now.getFullYear()),
    quarter,
  });
  console.log(`[ingest] Stored ${chunks.length} chunks in vector DB`);

  return {
    paperlessId,
    classification,
    extractedFields,
    chunksStored: chunks.length,
  };
}

// ─── Apply Tags in Paperless ─────────────────────────────

async function tagDocument(
  docId: number,
  classification: { agent: string; doc_type: string },
): Promise<void> {
  const tagMap = await paperless.getTagMap();
  const tagIds: number[] = [];

  const agentTag = tagMap.get(`agent:${classification.agent}`);
  if (agentTag) tagIds.push(agentTag);

  const typeTag = tagMap.get(`type:${classification.doc_type}`);
  if (typeTag) tagIds.push(typeTag);

  const now = new Date();
  const yearTag = tagMap.get(`year:${now.getFullYear()}`);
  if (yearTag) tagIds.push(yearTag);

  const quarter = Math.ceil((now.getMonth() + 1) / 3);
  const quarterTag = tagMap.get(`tax:q${quarter}`);
  if (quarterTag) tagIds.push(quarterTag);

  if (tagIds.length > 0) {
    await paperless.updateDocumentTags(docId, tagIds);
    console.log(`[ingest] Applied ${tagIds.length} tags to Paperless #${docId}`);
  }
}
