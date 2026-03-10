import { Bot } from 'grammy'
import type { AppContext } from './context.ts'
import type { AgentRunner } from '../runtime/runner.ts'
import type { AgentRegistry } from '../runtime/registry.ts'
import type { ToolRegistry } from '../tools/registry.ts'
import type { Config } from '../config/env.ts'
import { registerCommandHandlers } from './handlers/command.ts'
import { createMessageHandler } from './handlers/message.ts'
import { createDocumentHandler } from './handlers/document.ts'
import { logger } from '../utils/logger.ts'

export function createBot (
  runner: AgentRunner,
  registry: AgentRegistry,
  tools: ToolRegistry,
  config: Config
): Bot<AppContext> {
  const bot = new Bot<AppContext>(config.TELEGRAM_BOT_TOKEN)

  // Global error handler
  bot.catch((err) => {
    logger.error({ err: err.error, update: err.ctx.update }, 'Unhandled bot error')
  })

  // Logging middleware
  bot.use(async (ctx, next) => {
    logger.debug({ updateId: ctx.update.update_id }, 'Telegram update')
    await next()
  })

  registerCommandHandlers(bot, registry)

  const handleMessage = createMessageHandler(runner, registry, tools, config)
  const handleDocument = createDocumentHandler(bot, runner, registry, tools, config)

  bot.on('message:document', handleDocument)
  bot.on('message:photo', handleDocument)
  bot.on('message:text', handleMessage)

  return bot
}
