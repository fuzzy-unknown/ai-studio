import { Elysia } from 'elysia'
import { logger } from '../utils/logger'

export const errorPlugin = new Elysia({ name: 'plugin:error' })
  .onError(({ code, error, status }) => {
    const message = (error instanceof Error ? error.message : String(error)) || String(error)

    switch (code) {
      case 'VALIDATION':
        logger.warn({ code, details: error.all?.map(e => e.message) }, '[Error] Validation failed')
        return status(400, { error: 'Validation Error', details: error.all?.map(e => e.message) })
      case 'NOT_FOUND':
        return status(404, { error: 'Not Found' })
      case 'UNKNOWN':
        logger.error({ code, error: message, stack: error instanceof Error ? error.stack : undefined }, '[Error] Unhandled')
        return status(500, { error: message })
      default:
        logger.error({ code, error: message }, '[Error]')
        return status(500, { error: message })
    }
  })
  .as('global')
