import type { FastifyInstance } from "fastify";
import { getUpcomingDeadlines, getAllDeadlines } from "../services/scheduler.js";

export async function deadlineRoutes(app: FastifyInstance): Promise<void> {
  app.get("/deadlines", async (request) => {
    const query = request.query as { days?: string; all?: string };
    const days = parseInt(query.days ?? "30", 10);

    if (query.all === "true") {
      return { deadlines: getAllDeadlines() };
    }

    const upcoming = getUpcomingDeadlines(days);
    return {
      daysAhead: days,
      count: upcoming.length,
      deadlines: upcoming,
    };
  });
}
