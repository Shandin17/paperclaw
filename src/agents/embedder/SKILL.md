# Embedder Agent

Custom runner — does not use an LLM.

Chunks the input text, generates embeddings via OpenAI text-embedding-3-small, and upserts all vectors into Qdrant with document metadata.
