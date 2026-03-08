import Fastify from 'fastify';
import multipart from '@fastify/multipart';
import { config } from './config.js';
import { ensureCollection } from './services/vectorstore.js';
import { startScheduler } from './services/scheduler.js';
import { ingestRoutes } from './routes/ingest.js';
import { queryRoutes } from './routes/query.js';
import { utilityRoutes } from './routes/health.js';

async function main() {
  const app = Fastify({ logger: true });

  // Multipart support for file uploads (max 50MB)
  await app.register(multipart, { limits: { fileSize: 50 * 1024 * 1024 } });

  // Register routes
  await app.register(ingestRoutes);
  await app.register(queryRoutes);
  await app.register(utilityRoutes);

  // Initialize services
  try {
    await ensureCollection();
    console.log('Qdrant collection ready');
  } catch (err) {
    console.warn('Qdrant not available yet (will retry on first request):', (err as Error).message);
  }

  // Start scheduler
  startScheduler();

  // Start server
  await app.listen({ port: config.PORT, host: '0.0.0.0' });
  console.log(`PaperClaw Core running on http://0.0.0.0:${config.PORT}`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
