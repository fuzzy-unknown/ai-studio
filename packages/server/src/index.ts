import { openapi } from '@elysia/openapi'
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
  .use(openapi({
    documentation: {
      info: {
        title: 'AI Studio API',
        version: '1.0.0',
        description: 'AI Studio — AI 视频与图片生成服务 API 文档',
      },
      tags: [
        { name: '统一任务', description: '跨模块的任务查询、删除、取消及 SSE 事件流' },
        { name: '视频生成', description: 'HappyHorse / Wan2.7 视频生成相关接口' },
        { name: '图片生成', description: 'Qwen 图片生成与编辑相关接口' },
        { name: '定价管理', description: '模型定价配置的 CRUD 接口' },
      ],
    },
  }))
  .use(taskModule)
  .use(videoModule)
  .use(imageModule)
  .use(pricingModule)
  .listen(4000)

logger.info(`Server running at http://localhost:${app.server!.port}`)
