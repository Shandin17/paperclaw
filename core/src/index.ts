import Fastify from "fastify";
import multipart from "@fastify/multipart";
import { config } from "./config.js";
import { ensureCollection } from "./services/vectorstore.js";
import { startScheduler } from "./services/scheduler.js";
import { healthRoutes } from "./routes/health.js";
import { ingestRoutes } from "./routes/ingest.js";
import { queryRoutes } from "./routes/query.js";
import { deadlineRoutes } from "./routes/deadlines.js";

const app = Fastify({ logger: true });

// Plugins
await app.register(multipart, {
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
  },
});

// Routes
await app.register(healthRoutes);
await app.register(ingestRoutes);
await app.register(queryRoutes);
await app.register(deadlineRoutes);

// Startup
try {
  // Ensure Qdrant collection exists
  await ensureCollection();
  app.log.info("Qdrant collection ready");

  // Start tax deadline scheduler
  // In production, wire this to a notification channel (Telegram, etc.)
  startScheduler((message) => {
    app.log.info({ type: "deadline_notification" }, message);
  });

  // Start server
  await app.listen({ port: config.PORT, host: "0.0.0.0" });
  app.log.info(`PaperClaw Core running on port ${config.PORT}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
