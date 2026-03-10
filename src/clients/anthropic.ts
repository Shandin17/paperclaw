import Anthropic from '@anthropic-ai/sdk'
import { config } from '../config/env.ts'
import { logger } from '../utils/logger.ts'

const client = new Anthropic({ apiKey: config.ANTHROPIC_API_KEY })

export interface LLMCallParams {
  model: string
  system: string
  messages: Anthropic.MessageParam[]
  tools?: Anthropic.Tool[]
  maxTokens?: number
}

export interface LLMCallResult {
  content: Anthropic.ContentBlock[]
  usage: { inputTokens: number; outputTokens: number }
  stopReason: string
}

const MAX_RETRIES = 3
const RETRY_DELAYS = [1000, 2000, 4000]

export async function callLLM (params: LLMCallParams): Promise<LLMCallResult> {
  const { model, system, messages, tools, maxTokens = 4096 } = params

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const response = await client.messages.create({
        model,
        system,
        messages,
        tools,
        max_tokens: maxTokens,
      })

      return {
        content: response.content,
        usage: {
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens,
        },
        stopReason: response.stop_reason ?? 'end_turn',
      }
    } catch (err) {
      const isRetryable =
        err instanceof Anthropic.APIError &&
        (err.status === 429 || (err.status >= 500 && err.status < 600))

      if (isRetryable && attempt < MAX_RETRIES - 1) {
        logger.warn({ attempt, model }, 'Anthropic API error, retrying...')
        await sleep(RETRY_DELAYS[attempt] ?? 1000)
        continue
      }
      throw err
    }
  }

  throw new Error('Anthropic API: max retries exceeded')
}

function sleep (ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
