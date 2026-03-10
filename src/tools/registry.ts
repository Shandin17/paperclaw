import { logger } from '../utils/logger.ts'

export type ToolHandler = (input: Record<string, unknown>) => Promise<unknown>

export class ToolRegistry {
  private tools = new Map<string, ToolHandler>()

  register (name: string, handler: ToolHandler): void {
    this.tools.set(name, handler)
  }

  async execute (name: string, input: Record<string, unknown>): Promise<unknown> {
    const handler = this.tools.get(name)
    if (!handler) {
      throw new Error(`Unknown tool: ${name}`)
    }
    logger.debug({ tool: name }, 'Executing tool')
    return handler(input)
  }

  names (): string[] {
    return Array.from(this.tools.keys())
  }
}
