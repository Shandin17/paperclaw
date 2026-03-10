import { z } from 'zod'

const schema = z.object({
  TELEGRAM_BOT_TOKEN: z.string().min(1),
  ANTHROPIC_API_KEY: z.string().min(1),
  OPENAI_API_KEY: z.string().min(1),
  PAPERLESS_URL: z.string().default('http://paperless:8000'),
  PAPERLESS_TOKEN: z.string().min(1),
  QDRANT_URL: z.string().default('http://qdrant:6333'),
  QDRANT_COLLECTION: z.string().default('documents'),
  MAX_CALL_DEPTH: z.coerce.number().int().positive().default(6),
  TRACE_DIR: z.string().default('./data/traces'),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
  ALLOWED_CHAT_IDS: z.string().min(1),
})

const parsed = schema.safeParse(process.env)

if (!parsed.success) {
  console.error('❌ Invalid environment variables:')
  for (const issue of parsed.error.issues) {
    console.error(`  ${issue.path.join('.')}: ${issue.message}`)
  }
  process.exit(1)
}

export type Config = z.infer<typeof schema>
export const config: Config = parsed.data
