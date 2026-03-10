import { v4 as uuidv4 } from 'uuid'
import type { TraceNode } from '../runtime/types.ts'

export interface RequestTrace {
  traceId: string
  chatId: number
  userMessage: string
  rootNode: TraceNode
  totalLatencyMs: number
  totalTokens: { input: number; output: number }
  timestamp: string
}

export function createRootNode (agent: string, model: string, input: string): TraceNode {
  return {
    id: uuidv4(),
    agent,
    model,
    input: input.slice(0, 200),
    output: '',
    startedAt: Date.now(),
    children: [],
  }
}

export function createChildNode (agent: string, model: string, input: string): TraceNode {
  return createRootNode(agent, model, input)
}

export function finalizeNode (
  node: TraceNode,
  output: string,
  tokenUsage?: { input: number; output: number },
  error?: string
): void {
  node.completedAt = Date.now()
  node.latencyMs = node.completedAt - node.startedAt
  node.output = output.slice(0, 200)
  if (tokenUsage) node.tokenUsage = tokenUsage
  if (error) node.error = error
}

export function buildRequestTrace (
  traceId: string,
  chatId: number,
  userMessage: string,
  rootNode: TraceNode
): RequestTrace {
  const totalTokens = sumTokens(rootNode)

  return {
    traceId,
    chatId,
    userMessage: userMessage.slice(0, 200),
    rootNode,
    totalLatencyMs: rootNode.latencyMs ?? 0,
    totalTokens,
    timestamp: new Date().toISOString(),
  }
}

function sumTokens (node: TraceNode): { input: number; output: number } {
  const own = node.tokenUsage ?? { input: 0, output: 0 }
  return node.children.reduce(
    (acc, child) => {
      const c = sumTokens(child)
      return { input: acc.input + c.input, output: acc.output + c.output }
    },
    own
  )
}
