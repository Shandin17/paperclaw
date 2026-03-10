const CHUNK_SIZE = 512 // approx tokens (using word-based split)
const CHUNK_OVERLAP = 64

/**
 * Splits text into overlapping chunks of ~512 tokens.
 * Uses a simple word-based approximation (1 token ≈ 0.75 words).
 */
export function chunkText (text: string): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  const chunkWords = Math.round(CHUNK_SIZE * 0.75)
  const overlapWords = Math.round(CHUNK_OVERLAP * 0.75)

  const chunks: string[] = []
  let start = 0

  while (start < words.length) {
    const end = Math.min(start + chunkWords, words.length)
    chunks.push(words.slice(start, end).join(' '))
    if (end === words.length) break
    start += chunkWords - overlapWords
  }

  return chunks.filter(c => c.trim().length > 0)
}
