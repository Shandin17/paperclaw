import pino from 'pino'
import { config } from '../config/env.ts'

export const logger = pino({
  level: config.LOG_LEVEL,
  transport:
    process.env.NODE_ENV !== 'production'
      ? { target: 'pino-pretty', options: { colorize: true } }
      : undefined,
})
