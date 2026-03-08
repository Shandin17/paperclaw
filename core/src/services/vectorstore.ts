import { QdrantClient } from "@qdrant/js-client-rest";
import crypto from "crypto";
import { config } from "../config.js";

const client = new QdrantClient({ url: config.QDRANT_URL });
const COLLECTION = "paperclaw_docs";

export async function ensureCollection(): Promise<void> {
  const collections = await client.getCollections();
  const exists = collections.collections.some((c) => c.name === COLLECTION);
  if (!exists) {
    await client.createCollection(COLLECTION, {
      vectors: { size: 1536, distance: "Cosine" },
    });
    console.log(`Created Qdrant collection: ${COLLECTION}`);
  }
}

export async function upsertDocument(
  paperlessId: number,
  chunks: string[],
  embeddings: number[][],
  metadata: { agent: string; docType: string; year: string; quarter: string },
): Promise<void> {
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
): Promise<{ text: string; paperlessId: number; score: number }[]> {
  const must: Array<{ key: string; match: { value: string } }> = [];
  if (filters?.agent) {
    must.push({ key: "agent", match: { value: filters.agent } });
  }
  if (filters?.docType) {
    must.push({ key: "docType", match: { value: filters.docType } });
  }

  const response = await client.query(COLLECTION, {
    query: queryEmbedding,
    filter: must.length ? { must } : undefined,
    limit,
    with_payload: true,
  });

  const points = Array.isArray(response) ? response : (response as { points: unknown[] }).points ?? [];
  return (points as Array<{ payload: Record<string, unknown>; score: number }>).map((r) => ({
    text: r.payload.text as string,
    paperlessId: r.payload.paperless_id as number,
    score: r.score,
  }));
}

export async function deleteDocument(paperlessId: number): Promise<void> {
  await client.delete(COLLECTION, {
    filter: {
      must: [{ key: "paperless_id", match: { value: paperlessId } }],
    },
  });
}
