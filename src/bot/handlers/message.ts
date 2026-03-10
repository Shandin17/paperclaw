import { v4 as uuidv4 } from 'uuid'
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
import { logger } from '../../utils/logger.ts'

export function createMessageHandler (
  runner: AgentRunner,
  registry: AgentRegistry,
  tools: ToolRegistry,
  config: Config
) {
  return async function handleMessage (ctx: AppContext): Promise<void> {
    const chatId = ctx.chat?.id
    const text = ctx.message?.text
    if (!chatId || !text) return

    const history = getHistory(chatId)
    appendHistory(chatId, { role: 'user', text, timestamp: Date.now() })

    const traceId = uuidv4()
    const rootNode = createRootNode('chatter', 'claude-haiku-4-5-20251001', text)
    const loopGuard = new LoopGuard(config.MAX_CALL_DEPTH)

    const invoke = createInvokeFn('__bot__', registry, runner, loopGuard, rootNode, tools, config)

    const rootContext = {
      invoke,
      tools,
      traceNode: rootNode,
      config,
    }

    try {
      const output = await runner.run('chatter', { message: text, history }, rootContext)
      const reply = String(output.result.reply ?? 'Sorry, something went wrong.')

      await ctx.reply(reply)
      appendHistory(chatId, { role: 'assistant', text: reply, timestamp: Date.now() })

      const trace = buildRequestTrace(traceId, chatId, text, rootNode)
      await saveTrace(trace)
    } catch (err) {
      logger.error({ err, chatId }, 'Error handling message')
      await ctx.reply('An error occurred. Please try again.')
    }
  }
}
