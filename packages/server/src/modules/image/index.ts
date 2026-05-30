import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { Elysia, t } from 'elysia'
import { logger } from '../../utils/logger'
import { getModel, isQwenImageModel } from '../task/model-registry'
import { resolveTaskMediaUrl } from '../task/shared'
import { createSSEStream } from '../task/sse'
import {
  ImageGenerateBody,
  ImageGenerateResponse,
  ImageTaskListResponse,
  ImageUsageStatsResponse,
} from './model'
import { ImageService } from './service'

export const imageModule = new Elysia({ prefix: '/api/image', name: 'module:image' })
  .onBeforeHandle(({ request }) => {
    logger.info({ method: request.method, url: request.url }, '[API-Image] Incoming request')
  })
  .onAfterHandle(({ request, set }) => {
    logger.info({ method: request.method, url: request.url, status: set.status }, '[API-Image] Response sent')
  })
  .model({
    imageGenerateBody: ImageGenerateBody,
    imageGenerateResponse: ImageGenerateResponse,
    imageTaskListResponse: ImageTaskListResponse,
    imageUsageStatsResponse: ImageUsageStatsResponse,
  })
  .post('/generate', async ({ body }) => {
    const result = await ImageService.createTask(body as any)
    return { task_id: result.taskId, status: result.status }
  }, {
    body: 'imageGenerateBody',
    response: { 200: 'imageGenerateResponse', 400: t.Object({ error: t.String() }) },
    beforeHandle: ({ body, status }) => {
      const b = body as any
      const model = b.model || 'qwen-image-2.0-pro'

      if (!isQwenImageModel(model)) {
        return status(400, { error: `Invalid model: ${model}. Must be a qwen-image model.` })
      }

      const modelDef = getModel(model)
      if (modelDef) {
        const err = modelDef.validate(b)
        if (err) {
          return status(400, { error: err })
        }
      }
      else {
        // 未在注册表中的 qwen-image 变体（如日期快照），只做基础校验
        if (b.imageUrls && b.imageUrls.length > 3) {
          return status(400, { error: 'imageUrls must contain 1-3 images' })
        }
      }
    },
  })
  .get('/tasks', () => ImageService.getAllTasks(), {
    response: { 200: 'imageTaskListResponse' },
  })
  .get('/usage/stats', () => ImageService.getUsageStats(), {
    response: { 200: 'imageUsageStatsResponse' },
  })
  .get('/tasks/:taskId', async ({ params: { taskId }, set }) => {
    const task = await ImageService.getTaskByTaskId(taskId)
    if (!task) {
      set.status = 404
      return { error: 'Task not found' }
    }
    return task
  })
  .get('/tasks/:taskId/events', ({ params: { taskId } }) => {
    return createSSEStream(taskId, {
      resolveMediaUrl: resolveTaskMediaUrl,
      logPrefix: '[SSE-Image]',
    })
  })
  .get('/files/:filename', async ({ params: { filename }, set }) => {
    const filePath = resolve(import.meta.dir, '../../../storage/images', filename)
    if (!existsSync(filePath)) {
      set.status = 404
      return { error: 'File not found' }
    }
    return Bun.file(filePath)
  })
