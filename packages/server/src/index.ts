import { cors } from '@elysiajs/cors'
import { Elysia } from 'elysia'
import { errorPlugin } from './plugins/error'
import { pricingModule } from './modules/pricing'
import { videoModule } from './modules/video'
import { logger } from './utils/logger'

const app = new Elysia()
  .use(cors())
  .use(errorPlugin)
  .use(videoModule)
  .use(pricingModule)
  .listen(4000)

logger.info(`Server running at http://localhost:${app.server!.port}`)
