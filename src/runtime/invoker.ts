import { v4 as uuidv4 } from 'uuid'
import type { AgentRegistry } from './registry.ts'
import type { AgentRunner } from './runner.ts'
import type { LoopGuard } from './loop-guard.ts'
import type { AgentContext, AgentOutput, InvokeFn, TraceNode } from './types.ts'
import { UnknownAgentError } from './types.ts'
import type { ToolRegistry } from '../tools/registry.ts'
import type { Config } from '../config/env.ts'
import { logger } from '../utils/logger.ts'

export function createInvokeFn (
  callerAgent: string,
  registry: AgentRegistry,
  runner: AgentRunner,
  loopGuard: LoopGuard,
  parentTraceNode: TraceNode,
  tools: ToolRegistry,
  config: Config
): InvokeFn {
  return async function invoke (
    agentName: string,
    input: Record<string, unknown>
  ): Promise<AgentOutput> {
    const callerDef = registry.get(callerAgent)
    if (callerDef) {
      const allowed = callerDef.manifest.canInvoke
      if (allowed !== 'any' && !allowed.includes(agentName)) {
        throw new Error(`Agent "${callerAgent}" is not allowed to invoke "${agentName}"`)
      }
    }

    const targetDef = registry.get(agentName)
    if (!targetDef) throw new UnknownAgentError(agentName)

    loopGuard.enter()

    const childNode: TraceNode = {
      id: uuidv4(),
      agent: agentName,
      model: targetDef.manifest.model,
      input: JSON.stringify(input).slice(0, 200),
      output: '',
      startedAt: Date.now(),
      children: [],
    }
    parentTraceNode.children.push(childNode)

    const childInvoke = createInvokeFn(
      agentName,
      registry,
      runner,
      loopGuard,
      childNode,
      tools,
      config
    )

    const childContext: AgentContext = {
      invoke: childInvoke,
      tools,
      traceNode: childNode,
      config,
    }

    try {
      logger.debug({ caller: callerAgent, target: agentName }, 'Agent invoke')
      const output = await runner.run(agentName, input, childContext)
      return output
    } finally {
      loopGuard.exit()
    }
  }
}
