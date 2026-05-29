import { cors } from '@elysiajs/cors'
import { Elysia } from 'elysia'
import { videoModule } from './modules/video'
import { logger } from './utils/logger'

const app = new Elysia()
  .use(cors())
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
  .use(videoModule)
  .listen(4000)

logger.info(`Server running at http://localhost:${app.server!.port}`)
