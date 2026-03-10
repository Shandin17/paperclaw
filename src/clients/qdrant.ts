import { QdrantClient as QdrantRestClient } from '@qdrant/js-client-rest'
import { config } from '../config/env.ts'
import { logger } from '../utils/logger.ts'

export interface QdrantPoint {
  id: string
  vector: number[]
  payload: {
    documentId: string
    chunkIndex: number
    title?: string
    documentType?: string
    text?: string
  }
}

export interface QdrantSearchResult {
  id: string
  score: number
  payload: QdrantPoint['payload']
}

export interface QdrantFilter {
  must?: Array<{ key: string; match: { value: string | number | boolean } }>
}

const VECTOR_SIZE = 1536

export class QdrantClient {
  private client: QdrantRestClient
  private collection: string

  constructor () {
    this.client = new QdrantRestClient({ url: config.QDRANT_URL })
    this.collection = config.QDRANT_COLLECTION
  }

  async ensureCollection (): Promise<void> {
    try {
      await this.client.getCollection(this.collection)
      logger.debug({ collection: this.collection }, 'Qdrant collection already exists')
    } catch {
      logger.info({ collection: this.collection }, 'Creating Qdrant collection')
      await this.client.createCollection(this.collection, {
        vectors: {
          size: VECTOR_SIZE,
          distance: 'Cosine',
        },
      })
    }
  }

  async upsert (points: QdrantPoint[]): Promise<void> {
    await this.client.upsert(this.collection, {
      wait: true,
      points: points.map(p => ({
        id: p.id,
        vector: p.vector,
        payload: p.payload as Record<string, unknown>,
      })),
    })
  }

  async search (
    vector: number[],
    limit = 5,
    filter?: QdrantFilter
  ): Promise<QdrantSearchResult[]> {
    const results = await this.client.search(this.collection, {
      vector,
      limit,
      filter: filter as Record<string, unknown> | undefined,
      with_payload: true,
    })

    return results.map(r => ({
      id: String(r.id),
      score: r.score,
      payload: r.payload as QdrantPoint['payload'],
    }))
  }

  async deleteByDocumentId (documentId: string): Promise<void> {
    await this.client.delete(this.collection, {
      wait: true,
      filter: {
        must: [{ key: 'documentId', match: { value: documentId } }],
      },
    })
  }
}
