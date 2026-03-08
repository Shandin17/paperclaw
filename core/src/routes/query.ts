import type { FastifyInstance } from 'fastify';
import { routeToAgent } from '../agents/router.js';

export async function queryRoutes(app: FastifyInstance): Promise<void> {
  // Text-only query
  app.post('/query', async (request, reply) => {
    const { agent, message } = request.body as { agent?: string; message: string };

    if (!message) {
      return reply.status(400).send({ error: 'message is required' });
    }

    console.log(`[POST /query] agent=${agent ?? 'auto'} message="${message.slice(0, 80)}..."`);

    try {
      const result = await routeToAgent(agent, message);

      // If response has attachments, encode them as base64 for JSON transport
      const response: any = { agent: result.agent, text: result.text };
      if (result.attachments?.length) {
        response.attachments = result.attachments.map((a) => ({
          filename: a.filename,
          mimeType: a.mimeType,
          base64: a.buffer.toString('base64'),
        }));
      }

      return reply.send(response);
    } catch (err) {
      console.error('[POST /query] Error:', err);
      return reply.status(500).send({
        error: err instanceof Error ? err.message : 'Query failed',
      });
    }
  });

  // Query with file attachment (for form filling)
  app.post('/query-with-file', async (request, reply) => {
    const parts = request.parts();
    let agent: string | undefined;
    let message = '';
    let fileBuffer: Buffer | undefined;
    let fileName: string | undefined;

    for await (const part of parts) {
      if (part.type === 'field') {
        if (part.fieldname === 'agent') agent = part.value as string;
        if (part.fieldname === 'message') message = part.value as string;
      } else if (part.type === 'file') {
        fileBuffer = await part.toBuffer();
        fileName = part.filename;
      }
    }

    if (!message) {
      return reply.status(400).send({ error: 'message is required' });
    }

    console.log(`[POST /query-with-file] agent=${agent ?? 'auto'} file=${fileName ?? 'none'}`);

    try {
      const result = await routeToAgent(agent, message, fileBuffer, fileName);

      const response: any = { agent: result.agent, text: result.text };
      if (result.attachments?.length) {
        response.attachments = result.attachments.map((a) => ({
          filename: a.filename,
          mimeType: a.mimeType,
          base64: a.buffer.toString('base64'),
        }));
      }

      return reply.send(response);
    } catch (err) {
      console.error('[POST /query-with-file] Error:', err);
      return reply.status(500).send({
        error: err instanceof Error ? err.message : 'Query failed',
      });
    }
  });
}
