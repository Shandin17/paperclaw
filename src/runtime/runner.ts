import Anthropic from '@anthropic-ai/sdk'
import type {
  AgentDefinition,
  AgentContext,
  AgentOutput,
  TraceNode,
} from './types.ts'
import type { AgentRegistry } from './registry.ts'
import { callLLM } from '../clients/anthropic.ts'
import { finalizeNode } from '../tracing/trace.ts'
import { logger } from '../utils/logger.ts'

const MAX_TOOL_ITERATIONS = 10

// Max tokens per agent model
const MAX_TOKENS: Record<string, number> = {
  'claude-haiku-4-5-20251001': 2048,
  'claude-sonnet-4-6': 4096,
  'claude-opus-4-6': 8192,
}

function maxTokensFor (model: string): number {
  return MAX_TOKENS[model] ?? 4096
}

export class AgentRunner {
  private registry: AgentRegistry
  constructor (registry: AgentRegistry) {
    this.registry = registry
  }

  async run (
    agentName: string,
    input: Record<string, unknown>,
    context: AgentContext
  ): Promise<AgentOutput> {
    const agentDef = this.registry.get(agentName)
    if (!agentDef) throw new Error(`Agent not found: ${agentName}`)

    const { traceNode } = context

    try {
      let output: AgentOutput

      if (agentDef.customRunner) {
        output = await agentDef.customRunner(input, context)
      } else {
        output = await this.runDefault(agentDef, input, context)
      }

      finalizeNode(
        traceNode,
        JSON.stringify(output.result),
        traceNode.tokenUsage
      )
      return output
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      finalizeNode(traceNode, '', undefined, message)
      throw err
    }
  }

  private async runDefault (
    agentDef: AgentDefinition,
    input: Record<string, unknown>,
    context: AgentContext
  ): Promise<AgentOutput> {
    const { manifest, systemPrompt } = agentDef
    const { tools, traceNode } = context

    const allManifests = this.registry.manifests()
    const system = buildSystemPrompt(
      systemPrompt,
      allManifests,
      manifest.tools
    )
    const userContent = JSON.stringify(input)

    const anthropicTools: Anthropic.Tool[] = manifest.tools.flatMap((name) =>
      getAnthropicToolDefs(name)
    )

    // Add invoke_agent tool for agents that can call other agents
    const canInvoke = manifest.canInvoke
    if (canInvoke === 'any' || (Array.isArray(canInvoke) && canInvoke.length > 0)) {
      const allowedAgents = canInvoke === 'any' ? this.registry.names() : canInvoke
      anthropicTools.push(buildInvokeAgentTool(allowedAgents))
    }

    const messages: Anthropic.MessageParam[] = [
      { role: 'user', content: userContent },
    ]

    let totalInputTokens = 0
    let totalOutputTokens = 0

    for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
      const result = await callLLM({
        model: manifest.model,
        system,
        messages,
        tools: anthropicTools.length > 0 ? anthropicTools : undefined,
        maxTokens: maxTokensFor(manifest.model),
      })

      totalInputTokens += result.usage.inputTokens
      totalOutputTokens += result.usage.outputTokens

      const toolUseBlocks = result.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use'
      )

      if (toolUseBlocks.length === 0 || result.stopReason === 'end_turn') {
        traceNode.tokenUsage = {
          input: totalInputTokens,
          output: totalOutputTokens,
        }
        const textBlock = result.content.find(
          (b): b is Anthropic.TextBlock => b.type === 'text'
        )
        const text = textBlock?.text ?? '{}'
        return { result: parseJsonOrWrap(text), traceNode }
      }

      // Execute tool calls
      const toolResults: Anthropic.ToolResultBlockParam[] = []
      for (const toolUse of toolUseBlocks) {
        try {
          let toolResult: unknown

          if (toolUse.name === 'invoke_agent') {
            const { agent, input: agentInput } = toolUse.input as {
              agent: string
              input: Record<string, unknown>
            }
            const agentOutput = await context.invoke(agent, agentInput)
            toolResult = agentOutput.result
          } else {
            toolResult = await tools.execute(
              toolUse.name,
              toolUse.input as Record<string, unknown>
            )
          }

          toolResults.push({
            type: 'tool_result',
            tool_use_id: toolUse.id,
            content: JSON.stringify(toolResult),
          })
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err)
          logger.warn({ tool: toolUse.name, err: message }, 'Tool call failed')
          toolResults.push({
            type: 'tool_result',
            tool_use_id: toolUse.id,
            content: `Error: ${message}`,
            is_error: true,
          })
        }
      }

      messages.push({ role: 'assistant', content: result.content })
      messages.push({ role: 'user', content: toolResults })
    }

    traceNode.tokenUsage = {
      input: totalInputTokens,
      output: totalOutputTokens,
    }
    return { result: { error: 'Max tool iterations reached' }, traceNode }
  }
}

function buildSystemPrompt (
  skillMd: string,
  allManifests: ReturnType<AgentRegistry['manifests']>,
  agentTools: string[]
): string {
  const agentList = JSON.stringify(
    allManifests.map((m) => ({
      name: m.name,
      description: m.description,
      triggers: m.triggers ?? [],
    })),
    null,
    2
  )

  const toolList =
    agentTools.length > 0 ? `\nAvailable tools: ${agentTools.join(', ')}` : ''

  return `${skillMd}

---
Available agents (for routing decisions):
${agentList}
${toolList}

Always respond with valid JSON matching the output schema.`
}

function parseJsonOrWrap (text: string): Record<string, unknown> {
  const trimmed = text.trim()
  // Extract JSON from markdown code blocks if present
  const match = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/)
  const jsonStr = match ? match[1].trim() : trimmed

  try {
    return JSON.parse(jsonStr) as Record<string, unknown>
  } catch {
    return { reply: text }
  }
}

function buildInvokeAgentTool (allowedAgents: string[]): Anthropic.Tool {
  return {
    name: 'invoke_agent',
    description:
      'Delegate a task to a specialist agent and get back its result. ' +
      `Allowed agents: ${allowedAgents.join(', ')}.`,
    input_schema: {
      type: 'object',
      properties: {
        agent: {
          type: 'string',
          enum: allowedAgents,
          description: 'Name of the agent to invoke',
        },
        input: {
          type: 'object',
          description: 'Input payload for the agent',
        },
      },
      required: ['agent', 'input'],
    },
  }
}

// Tool definitions passed to the Anthropic API
function getAnthropicToolDefs (toolGroup: string): Anthropic.Tool[] {
  if (toolGroup === 'paperless') return PAPERLESS_TOOLS
  if (toolGroup === 'qdrant') return QDRANT_TOOLS
  return []
}

const PAPERLESS_TOOLS: Anthropic.Tool[] = [
  {
    name: 'paperless_upload',
    description: 'Upload a document file to Paperless-ngx for storage and OCR.',
    input_schema: {
      type: 'object',
      properties: {
        filePath: { type: 'string', description: 'Local path to the file' },
        title: { type: 'string', description: 'Document title' },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Tag names to apply',
        },
        documentType: { type: 'string', description: 'Document type name' },
      },
      required: ['filePath'],
    },
  },
  {
    name: 'paperless_get',
    description: 'Get document metadata and OCR text by document ID.',
    input_schema: {
      type: 'object',
      properties: {
        documentId: { type: 'integer', description: 'Paperless document ID' },
      },
      required: ['documentId'],
    },
  },
  {
    name: 'paperless_download',
    description: 'Download the original document file by ID.',
    input_schema: {
      type: 'object',
      properties: {
        documentId: { type: 'integer', description: 'Paperless document ID' },
      },
      required: ['documentId'],
    },
  },
  {
    name: 'paperless_search',
    description: 'Full-text search across all documents in Paperless.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
        limit: { type: 'integer', description: 'Max results', default: 5 },
      },
      required: ['query'],
    },
  },
  {
    name: 'paperless_list',
    description: 'List all stored documents with pagination.',
    input_schema: {
      type: 'object',
      properties: {
        page: { type: 'integer', default: 1 },
        pageSize: { type: 'integer', default: 25 },
      },
    },
  },
  {
    name: 'paperless_update',
    description: "Update a document's title, tags, or type.",
    input_schema: {
      type: 'object',
      properties: {
        documentId: { type: 'integer' },
        title: { type: 'string' },
        tags: { type: 'array', items: { type: 'string' } },
        documentType: { type: 'string' },
      },
      required: ['documentId'],
    },
  },
]

const QDRANT_TOOLS: Anthropic.Tool[] = [
  {
    name: 'qdrant_search',
    description:
      'Semantic search over document embeddings. Provide a text query; it will be embedded and searched.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Natural language search query' },
        limit: { type: 'integer', description: 'Max results', default: 5 },
        documentType: {
          type: 'string',
          description: 'Optional filter by document type',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'qdrant_upsert',
    description: 'Store document embeddings in the vector database.',
    input_schema: {
      type: 'object',
      properties: {
        documentId: { type: 'string' },
        text: { type: 'string', description: 'Full text to chunk and embed' },
        metadata: {
          type: 'object',
          description: 'Additional metadata to store',
        },
      },
      required: ['documentId', 'text'],
    },
  },
]

export type { TraceNode }
