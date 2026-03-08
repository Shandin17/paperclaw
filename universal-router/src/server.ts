import http from "node:http";
import { processDocument } from "./routes/documents.js";
import { getTransactions } from "./routes/experts/gestor/transactions.js";
import { generateDeclaration } from "./routes/experts/gestor/declarations.js";
import { getDeadlines } from "./routes/experts/gestor/deadlines.js";
import { analyseDocument } from "./routes/experts/medico/index.js";

type Handler = (body: unknown, url: URL) => Promise<unknown>;

const routes: Record<string, Partial<Record<string, Handler>>> = {
  // ── Universal classifier + router ─────────────────────────────────────────
  "/documents/process":         { POST: processDocument },

  // ── Gestor (Spanish tax) ──────────────────────────────────────────────────
  "/gestor/transactions":        { GET:  (_b, url) => getTransactions(url) },
  "/gestor/declarations/generate": { POST: generateDeclaration },
  "/gestor/deadlines":           { GET:  getDeadlines },

  // ── Medico (medical/fitness) ──────────────────────────────────────────────
  "/medico/analyse":             { POST: analyseDocument },
};

export function startServer(port = 3000) {
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", `http://localhost:${port}`);
    const method = req.method ?? "GET";

    const handler = routes[url.pathname]?.[method];
    if (!handler) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: `${method} ${url.pathname} not found` }));
      return;
    }

    try {
      let body: unknown = {};
      if (method !== "GET") {
        const raw = await new Promise<string>((resolve, reject) => {
          let data = "";
          req.on("data", (chunk) => (data += chunk));
          req.on("end", () => resolve(data));
          req.on("error", reject);
        });
        body = raw ? JSON.parse(raw) : {};
      }

      const result = await handler(body, url);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(result));
    } catch (err) {
      console.error(err);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: String(err) }));
    }
  });

  server.listen(port, () => console.log(`universal-router API listening on :${port}`));
}
