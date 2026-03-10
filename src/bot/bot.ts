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

  // Authorization middleware
  const allowedIds = config.ALLOWED_CHAT_IDS
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
    .map(Number)

  bot.use(async (ctx, next) => {
    const id = ctx.chat?.id ?? ctx.from?.id
    if (id !== undefined && allowedIds.includes(id)) {
      await next()
    } else if (id !== undefined) {
      await ctx.reply(
        `⛔ You are not authorized to use this bot.\n\nYour chat ID: \`${id}\`\n\nAsk the owner to add it.`,
        { parse_mode: 'Markdown' }
      )
    }
  })

  registerCommandHandlers(bot, registry)

  const handleMessage = createMessageHandler(runner, registry, tools, config)
  const handleDocument = createDocumentHandler(bot, runner, registry, tools, config)

  bot.on('message:document', handleDocument)
  bot.on('message:photo', handleDocument)
  bot.on('message:text', handleMessage)

  return bot
}
