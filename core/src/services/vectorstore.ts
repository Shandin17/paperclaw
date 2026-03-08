import { QdrantClient } from '@qdrant/js-client-rest';
import crypto from 'crypto';
import { config } from '../config.js';
import type { DocumentMetadata, SearchResult } from '../types/document.js';

const client = new QdrantClient({ url: config.QDRANT_URL });
const COLLECTION = 'paperclaw_docs';
const VECTOR_SIZE = 1536; // text-embedding-3-small

// ─── Ensure Collection Exists ────────────────────────────

export async function ensureCollection(): Promise<void> {
  const { collections } = await client.getCollections();
  const exists = collections.some((c) => c.name === COLLECTION);
  if (!exists) {
    await client.createCollection(COLLECTION, {
      vectors: { size: VECTOR_SIZE, distance: 'Cosine' },
    });
    console.log(`Created Qdrant collection: ${COLLECTION}`);
  }
}

// ─── Store Document Chunks ───────────────────────────────

export async function upsertDocument(
  paperlessId: number,
  chunks: string[],
  embeddings: number[][],
  metadata: DocumentMetadata,
): Promise<void> {
  const points = chunks.map((chunk, i) => ({
    id: makeId(paperlessId, i),
    vector: embeddings[i],
    payload: {
      paperless_id: paperlessId,
      chunk_index: i,
      text: chunk,
      agent: metadata.agent,
      doc_type: metadata.docType,
      year: metadata.year,
      quarter: metadata.quarter,
    },
  }));

  await client.upsert(COLLECTION, { points });
}

// ─── Semantic Search ─────────────────────────────────────

export async function search(
  queryEmbedding: number[],
  filters?: { agent?: string; docType?: string },
  limit = 8,
): Promise<SearchResult[]> {
  const must: any[] = [];
  if (filters?.agent) {
    must.push({ key: 'agent', match: { value: filters.agent } });
  }
  if (filters?.docType) {
    must.push({ key: 'doc_type', match: { value: filters.docType } });
  }

  const results = await client.query(COLLECTION, {
    query: queryEmbedding,
    filter: must.length > 0 ? { must } : undefined,
    limit,
    with_payload: true,
  });

  const points = Array.isArray(results) ? results : (results as { points: unknown[] }).points ?? [];
  return (points as Array<{ payload: Record<string, unknown>; score: number }>).map((r) => ({
    text: (r.payload as any)?.text ?? '',
    paperlessId: (r.payload as any)?.paperless_id ?? 0,
    score: r.score ?? 0,
  }));
}

// ─── Delete Document Vectors ─────────────────────────────

export async function deleteDocument(paperlessId: number): Promise<void> {
  await client.delete(COLLECTION, {
    filter: {
      must: [{ key: 'paperless_id', match: { value: paperlessId } }],
    },
  });
}

// ─── Helpers ─────────────────────────────────────────────

function makeId(docId: number, chunkIndex: number): string {
  return crypto.createHash('md5').update(`${docId}_${chunkIndex}`).digest('hex');
}
