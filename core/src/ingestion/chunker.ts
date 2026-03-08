/**
 * Split text into overlapping word-based chunks for embedding.
 */
export function chunkText(
  text: string,
  chunkSize = 500,
  overlap = 50,
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [text.slice(0, 2000) || 'empty document'];

  const chunks: string[] = [];
  const step = chunkSize - overlap;

  for (let i = 0; i < words.length; i += step) {
    const chunk = words.slice(i, i + chunkSize).join(' ');
    if (chunk.trim()) chunks.push(chunk);
  }

  return chunks.length > 0 ? chunks : [text.slice(0, 2000)];
}
