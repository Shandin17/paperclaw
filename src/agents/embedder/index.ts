import { v4 as uuidv4 } from 'uuid'
import { chunkText } from '../../utils/chunker.ts'
import { embed } from '../../clients/openai.ts'
import { QdrantClient } from '../../clients/qdrant.ts'
import type { AgentContext, AgentOutput } from '../../runtime/types.ts'

const qdrant = new QdrantClient()

export default async function embedderRunner (
  input: Record<string, unknown>,
  context: AgentContext
): Promise<AgentOutput> {
  const { text, documentId, metadata } = input as {
    text: string
    documentId: string
    metadata?: { title?: string; documentType?: string }
  }

  const chunks = chunkText(text)
  if (chunks.length === 0) {
    return { result: { chunksStored: 0, dimensions: 1536 }, traceNode: context.traceNode }
  }

  const vectors = await embed(chunks)

  await qdrant.ensureCollection()
  await qdrant.upsert(
    chunks.map((chunk, i) => ({
      id: uuidv4(),
      vector: vectors[i] ?? [],
      payload: {
        documentId,
        chunkIndex: i,
        text: chunk.slice(0, 200),
        title: metadata?.title,
        documentType: metadata?.documentType,
      },
    }))
  )

  return {
    result: { chunksStored: chunks.length, dimensions: 1536 },
    traceNode: context.traceNode,
  }
}
