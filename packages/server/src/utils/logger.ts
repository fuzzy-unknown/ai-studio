import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'
import pino from 'pino'

const LOGS_DIR = join(import.meta.dir, '../../logs')

function getLogFilePath(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  const dir = join(LOGS_DIR, `${y}`, `${m}`, `${d}`)
  mkdirSync(dir, { recursive: true })
  const h = String(now.getHours()).padStart(2, '0')
  return join(dir, `${h}.log`)
}

export const logger = pino(
  {
    level: process.env.LOG_LEVEL || 'info',
    timestamp: pino.stdTimeFunctions.isoTime,
  },
  pino.transport({
    targets: [
      { target: 'pino/file', options: { destination: 1 } },
      { target: 'pino/file', options: { destination: getLogFilePath(), mkdir: true } },
    ],
  }),
)
