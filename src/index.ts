import path from 'path'
import { fileURLToPath } from 'url'
import { config } from './config/env.ts'
import { logger } from './utils/logger.ts'
import { AgentRegistry } from './runtime/registry.ts'
import { AgentRunner } from './runtime/runner.ts'
import { ToolRegistry } from './tools/registry.ts'
import { registerPaperlessTools } from './tools/paperless.tool.ts'
import { registerQdrantTools } from './tools/qdrant.tool.ts'
import { QdrantClient } from './clients/qdrant.ts'
import { createBot } from './bot/bot.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

async function main (): Promise<void> {
  logger.info('Starting Paperclaw...')

  // Ensure Qdrant collection exists
  const qdrant = new QdrantClient()
  await qdrant.ensureCollection()

  // Load agents
  const registry = new AgentRegistry()
  const agentsDir = path.join(__dirname, 'agents')
  await registry.loadAll(agentsDir)

  // Register tools
  const tools = new ToolRegistry()
  registerPaperlessTools(tools)
  registerQdrantTools(tools)

  // Create runner
  const runner = new AgentRunner(registry)

  // Create and start bot
  const bot = createBot(runner, registry, tools, config)

  process.once('SIGINT', () => bot.stop())
  process.once('SIGTERM', () => bot.stop())

  logger.info('Bot starting...')
  await bot.start({
    onStart: (info) => logger.info({ username: info.username }, 'Bot is running'),
  })
}

main().catch((err) => {
  logger.fatal({ err }, 'Fatal startup error')
  process.exit(1)
})
