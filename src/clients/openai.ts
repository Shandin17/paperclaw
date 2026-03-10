import OpenAI from 'openai'
import { config } from '../config/env.ts'
import { logger } from '../utils/logger.ts'

const client = new OpenAI({ apiKey: config.OPENAI_API_KEY })

const MODEL = 'text-embedding-3-small'
const BATCH_SIZE = 100

export async function embed (texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return []

  const allVectors: number[][] = []

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE)
    try {
      const response = await client.embeddings.create({ model: MODEL, input: batch })
      const vectors = response.data.sort((a, b) => a.index - b.index).map(d => d.embedding)
      allVectors.push(...vectors)
    } catch (err) {
      logger.warn({ err, batchStart: i }, 'OpenAI embedding failed, retrying once')
      try {
        const response = await client.embeddings.create({ model: MODEL, input: batch })
        const vectors = response.data.sort((a, b) => a.index - b.index).map(d => d.embedding)
        allVectors.push(...vectors)
      } catch (retryErr) {
        logger.error({ retryErr }, 'OpenAI embedding failed after retry')
        throw retryErr
      }
    }
  }

  return allVectors
}
