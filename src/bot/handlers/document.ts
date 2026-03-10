import { v4 as uuidv4 } from 'uuid'
import type { Bot } from 'grammy'
import type { AppContext } from '../context.ts'
import { getHistory, appendHistory } from '../context.ts'
import type { AgentRunner } from '../../runtime/runner.ts'
import type { AgentRegistry } from '../../runtime/registry.ts'
import type { ToolRegistry } from '../../tools/registry.ts'
import type { Config } from '../../config/env.ts'
import { LoopGuard } from '../../runtime/loop-guard.ts'
import { createInvokeFn } from '../../runtime/invoker.ts'
import { createRootNode, buildRequestTrace } from '../../tracing/trace.ts'
import { saveTrace } from '../../tracing/store.ts'
import { saveTmpFile, getMimeType } from '../../utils/file.ts'
import { randomProcessingMessage } from '../processing-messages.ts'
import { logger } from '../../utils/logger.ts'

export function createDocumentHandler (
  bot: Bot,
  runner: AgentRunner,
  registry: AgentRegistry,
  tools: ToolRegistry,
  config: Config
) {
  return async function handleDocument (ctx: AppContext): Promise<void> {
    const chatId = ctx.chat?.id
    const msg = ctx.message
    if (!chatId || !msg) return

    // Resolve file info from document or photo
    let fileId: string | undefined
    let filename: string = 'upload'

    if (msg.document) {
      fileId = msg.document.file_id
      filename = msg.document.file_name ?? 'document'
    } else if (msg.photo?.length) {
      const largest = msg.photo[msg.photo.length - 1]
      fileId = largest?.file_id
      filename = 'photo.jpg'
    }

    if (!fileId) return

    try {
      const fileInfo = await bot.api.getFile(fileId)
      const fileUrl = `https://api.telegram.org/file/bot${config.TELEGRAM_BOT_TOKEN}/${fileInfo.file_path}`
      const res = await fetch(fileUrl)
      if (!res.ok) throw new Error(`Failed to download file: ${res.status}`)
      const buffer = Buffer.from(await res.arrayBuffer())
      const tmpPath = await saveTmpFile(buffer, filename)
      const mimeType = getMimeType(tmpPath)
      const caption = msg.caption ?? 'New document'

      const history = getHistory(chatId)
      appendHistory(chatId, {
        role: 'user',
        text: caption,
        files: [tmpPath],
        timestamp: Date.now(),
      })

      const traceId = uuidv4()
      const rootNode = createRootNode('chatter', 'claude-haiku-4-5-20251001', caption)
      const loopGuard = new LoopGuard(config.MAX_CALL_DEPTH)
      const invoke = createInvokeFn('__bot__', registry, runner, loopGuard, rootNode, tools, config)

      const rootContext = { invoke, tools, traceNode: rootNode, config }

      const processingMsg = await ctx.reply(randomProcessingMessage())

      const output = await runner.run(
        'chatter',
        { message: caption, files: [tmpPath], mimeType, history },
        rootContext
      )

      const reply = String(output.result.reply ?? 'Done.')
      await ctx.api.editMessageText(chatId, processingMsg.message_id, reply, {
        parse_mode: 'Markdown',
      })
      appendHistory(chatId, { role: 'assistant', text: reply, timestamp: Date.now() })

      const trace = buildRequestTrace(traceId, chatId, caption, rootNode)
      await saveTrace(trace)
    } catch (err) {
      logger.error({ err, chatId }, 'Error handling document')
      await ctx.reply('Failed to process the file. Please try again.')
    }
  }
}
