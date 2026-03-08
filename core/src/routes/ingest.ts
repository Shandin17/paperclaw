import type { FastifyInstance } from "fastify";
import type { MultipartFile } from "@fastify/multipart";
import { ingestDocument } from "../ingestion/pipeline.js";

export async function ingestRoutes(app: FastifyInstance): Promise<void> {
  app.post("/ingest", async (request, reply) => {
    const data = await request.file();
    if (!data) {
      return reply.status(400).send({ error: "No file provided" });
    }

    const fileBuffer = await data.toBuffer();
    const filename = data.filename;
    const mimeType = data.mimetype;

    try {
      const result = await ingestDocument(fileBuffer, filename, mimeType);
      return {
        success: true,
        paperlessId: result.paperlessId,
        docType: result.docType,
        agent: result.agent,
        summary: result.summary,
        extractedFields: result.extractedFields,
      };
    } catch (err) {
      app.log.error(err);
      return reply.status(500).send({
        error: "Ingestion failed",
        message: (err as Error).message,
      });
    }
  });
}
