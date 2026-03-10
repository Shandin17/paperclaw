import type { ToolRegistry } from '../tools/registry.ts'
import type { Config } from '../config/env.ts'

export interface AgentManifest {
  name: string
  description: string
  triggers?: string[]
  model: string
  tools: string[]
  parallel: boolean
  canInvoke: 'any' | string[]
  trace: boolean
  inputSchema: Record<string, unknown>
  outputSchema: Record<string, unknown>
}

export interface AgentDefinition {
  manifest: AgentManifest
  systemPrompt: string
  customRunner?: CustomRunnerFn
}

export type CustomRunnerFn = (
  input: Record<string, unknown>,
  context: AgentContext
) => Promise<AgentOutput>

export interface AgentContext {
  invoke: InvokeFn
  tools: ToolRegistry
  traceNode: TraceNode
  config: Config
}

export type InvokeFn = (
  agentName: string,
  input: Record<string, unknown>
) => Promise<AgentOutput>

export interface AgentOutput {
  result: Record<string, unknown>
  traceNode: TraceNode
}

export interface TraceNode {
  id: string
  agent: string
  model: string
  input: string
  output: string
  startedAt: number
  completedAt?: number
  latencyMs?: number
  tokenUsage?: { input: number; output: number }
  children: TraceNode[]
  error?: string
}

export class MaxDepthError extends Error {
  constructor (maxDepth: number) {
    super(`Max agent call depth of ${maxDepth} exceeded`)
    this.name = 'MaxDepthError'
  }
}

export class UnknownAgentError extends Error {
  constructor (name: string) {
    super(`Unknown agent: ${name}`)
    this.name = 'UnknownAgentError'
  }
}
