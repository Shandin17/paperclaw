import { config as dotenv } from "dotenv";
import { resolve } from "path";
// Load .env from repo root (one level above core/)
dotenv({ path: resolve(process.cwd(), "../.env") });
dotenv({ path: resolve(process.cwd(), ".env") }); // fallback for Docker/VPS
import { z } from "zod";

const envSchema = z.object({
  PAPERLESS_URL: z.string().default("http://paperless:8000"),
  PAPERLESS_TOKEN: z.string().min(1, "PAPERLESS_TOKEN is required"),
  QDRANT_URL: z.string().default("http://qdrant:6333"),
  ANTHROPIC_API_KEY: z.string().min(1, "ANTHROPIC_API_KEY is required"),
  OPENAI_API_KEY: z.string().min(1, "OPENAI_API_KEY is required"),
  MODEL_FAST: z.string().default("claude-haiku-4-5-20251001"),
  MODEL_SMART: z.string().default("claude-sonnet-4-20250514"),
  EMBEDDING_MODEL: z.string().default("text-embedding-3-small"),
  PORT: z.coerce.number().default(8081),
});

export const config = envSchema.parse(process.env);
