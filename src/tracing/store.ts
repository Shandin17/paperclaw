import fs from 'fs/promises'
import path from 'path'
import { config } from '../config/env.ts'
import { logger } from '../utils/logger.ts'
import type { RequestTrace } from './trace.ts'

export async function saveTrace (trace: RequestTrace): Promise<void> {
  const date = trace.timestamp.slice(0, 10) // YYYY-MM-DD
  const dir = path.join(config.TRACE_DIR, date)

  try {
    await fs.mkdir(dir, { recursive: true })
    const file = path.join(dir, `trace-${trace.traceId}.json`)
    await fs.writeFile(file, JSON.stringify(trace, null, 2))
    logger.debug({ traceId: trace.traceId, file }, 'Trace saved')
  } catch (err) {
    logger.error({ err, traceId: trace.traceId }, 'Failed to save trace')
  }
}
