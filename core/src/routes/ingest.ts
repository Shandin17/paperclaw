import type { FastifyInstance } from 'fastify';
import { ingestDocument } from '../ingestion/pipeline.js';

export async function ingestRoutes(app: FastifyInstance): Promise<void> {
  app.post('/ingest', async (request, reply) => {
    const file = await request.file();
    if (!file) {
      return reply.status(400).send({ error: 'No file uploaded' });
    }

    const buffer = await file.toBuffer();
    const fileName = file.filename ?? 'document.pdf';

    console.log(`[POST /ingest] Received: ${fileName} (${buffer.length} bytes)`);

    try {
      const result = await ingestDocument(buffer, fileName);
      return reply.send(result);
    } catch (err) {
      console.error('[POST /ingest] Error:', err);
      return reply.status(500).send({
        error: err instanceof Error ? err.message : 'Ingestion failed',
      });
    }
  });
}
