import type { FastifyInstance } from 'fastify';
import { getUpcomingDeadlines } from '../services/scheduler.js';
import { getAgentNames } from '../agents/router.js';

export async function utilityRoutes(app: FastifyInstance): Promise<void> {
  app.get('/health', async () => ({
    status: 'ok',
    service: 'paperclaw-core',
    timestamp: new Date().toISOString(),
    agents: getAgentNames(),
  }));

  app.get('/deadlines', async () => ({
    deadlines: getUpcomingDeadlines(60),
  }));
}
