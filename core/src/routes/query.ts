import type { FastifyInstance } from "fastify";
import { getAgent, routeMessage } from "../agents/router.js";
import type { AgentResponse } from "../types/agent.js";

interface QueryBody {
  message: string;
  agent?: string;
}

export async function queryRoutes(app: FastifyInstance): Promise<void> {
  // Text-only query
  app.post<{ Body: QueryBody }>("/query", {
    schema: {
      body: {
        type: "object",
        required: ["message"],
        properties: {
          message: { type: "string" },
          agent: { type: "string" },
        },
      },
    },
  }, async (request, reply) => {
    const { message, agent: agentName } = request.body;

    try {
      const agent = agentName ? getAgent(agentName) : await routeMessage(message);
      const response: AgentResponse = await agent.answer(message);

      return {
        agent: response.agent,
        text: response.text,
        hasAttachments: (response.attachments?.length ?? 0) > 0,
      };
    } catch (err) {
      app.log.error(err);
      return reply.status(500).send({
        error: "Query failed",
        message: (err as Error).message,
      });
    }
  });

  // Multipart query (with file attachment)
  app.post("/query/file", async (request, reply) => {
    const parts = request.parts();
    let message = "";
    let agentName = "";
    let fileBuffer: Buffer | undefined;
    let filename = "";
    let mimeType = "";

    for await (const part of parts) {
      if (part.type === "field") {
        if (part.fieldname === "message") message = part.value as string;
        if (part.fieldname === "agent") agentName = part.value as string;
      } else if (part.type === "file") {
        fileBuffer = await part.toBuffer();
        filename = part.filename;
        mimeType = part.mimetype;
      }
    }

    if (!message) {
      return reply.status(400).send({ error: "message field required" });
    }

    try {
      const agent = agentName ? getAgent(agentName) : await routeMessage(message);
      const response: AgentResponse = await agent.answer(message, fileBuffer);

      if (response.attachments && response.attachments.length > 0) {
        // Return first attachment as binary with metadata in headers
        const attachment = response.attachments[0];
        return reply
          .header("Content-Type", attachment.mimeType)
          .header("Content-Disposition", `attachment; filename="${attachment.filename}"`)
          .header("X-Agent", response.agent)
          .header("X-Message", Buffer.from(response.text).toString("base64"))
          .send(attachment.buffer);
      }

      return {
        agent: response.agent,
        text: response.text,
      };
    } catch (err) {
      app.log.error(err);
      return reply.status(500).send({
        error: "Query failed",
        message: (err as Error).message,
      });
    }
  });
}
