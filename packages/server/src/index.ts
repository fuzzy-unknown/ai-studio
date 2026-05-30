import { cors } from '@elysiajs/cors'
import { Elysia } from 'elysia'
import { imageModule } from './modules/image'
import { pricingModule } from './modules/pricing'
import { taskModule } from './modules/task'
import { videoModule } from './modules/video'
import { errorPlugin } from './plugins/error'
import { logger } from './utils/logger'

const app = new Elysia()
  .use(cors())
  .use(errorPlugin)
  .use(taskModule)
  .use(videoModule)
  .use(imageModule)
  .use(pricingModule)
  .listen(4000)

logger.info(`Server running at http://localhost:${app.server!.port}`)
