import type { ToolRegistry } from './registry.ts'
import { QdrantClient } from '../clients/qdrant.ts'
import { embed } from '../clients/openai.ts'

const qdrant = new QdrantClient()

export function registerQdrantTools (registry: ToolRegistry): void {
  registry.register('qdrant_search', async (input) => {
    const { query, limit, documentType } = input as {
      query: string
      limit?: number
      documentType?: string
    }

    const [queryVector] = await embed([query])
    if (!queryVector) throw new Error('Failed to embed query')

    const filter = documentType
      ? { must: [{ key: 'documentType', match: { value: documentType } }] }
      : undefined

    return qdrant.search(queryVector, limit, filter)
  })

  registry.register('qdrant_upsert', async (input) => {
    const { documentId, text, metadata } = input as {
      documentId: string
      text: string
      metadata?: Record<string, unknown>
    }

    // Handled by the embedder agent; this tool is a fallback direct path
    const vectors = await embed([text])
    const vector = vectors[0]
    if (!vector) throw new Error('Failed to embed text')

    await qdrant.upsert([{
      id: `${documentId}-0`,
      vector,
      payload: {
        documentId,
        chunkIndex: 0,
        ...(metadata as { title?: string; documentType?: string })
      }
    }])

    return { success: true }
  })
}
