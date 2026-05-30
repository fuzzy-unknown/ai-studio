import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { Elysia, t } from 'elysia'
import { logger } from '../../utils/logger'
import { getModel } from '../task/model-registry'
import { resolveTaskMediaUrl } from '../task/shared'
import { createSSEStream } from '../task/sse'
import {
  GenerateBody,
  GenerateResponse,
  TaskListResponse,
  TaskResponse,
  UsageStatsResponse,
} from './model'
import { VideoService } from './service'

export const videoModule = new Elysia({ prefix: '/api/video', name: 'module:video' })
  .onBeforeHandle(({ request, body }) => {
    logger.info({ method: request.method, url: request.url, body }, '[API] Incoming request')
  })
  .onAfterHandle(({ request, set }) => {
    logger.info({ method: request.method, url: request.url, status: set.status }, '[API] Response sent')
  })
  .model({
    generateBody: GenerateBody,
    generateResponse: GenerateResponse,
    taskResponse: TaskResponse,
    taskListResponse: TaskListResponse,
    usageStatsResponse: UsageStatsResponse,
  })
  .post('/generate', async ({ body }) => {
    const result = await VideoService.createTask(body as any)
    return { task_id: result.taskId, status: result.status }
  }, {
    body: 'generateBody',
    response: { 200: 'generateResponse', 400: t.Object({ error: t.String() }) },
    beforeHandle: ({ body, status }) => {
      const b = body as any
      const model = b.model || 'happyhorse-1.0-t2v'
      const modelDef = getModel(model)
      if (!modelDef || modelDef.category !== 'video') {
        return status(400, { error: `Invalid video model: ${model}` })
      }
      const err = modelDef.validate(b)
      if (err) {
        return status(400, { error: err })
      }
    },
  })
  .get('/tasks', () => VideoService.getAllTasks(), {
    response: { 200: 'taskListResponse' },
  })
  .get('/usage/stats', () => VideoService.getUsageStats(), {
    response: { 200: 'usageStatsResponse' },
  })
  .get('/tasks/:taskId', async ({ params: { taskId }, set }) => {
    const task = await VideoService.getTaskByTaskId(taskId)
    if (!task) {
      set.status = 404
      return { error: 'Task not found' }
    }
    return task
  })
  .get('/tasks/:taskId/events', ({ params: { taskId } }) => {
    return createSSEStream(taskId, {
      resolveMediaUrl: resolveTaskMediaUrl,
      logPrefix: '[SSE]',
    })
  })
  // 视频文件服务：提供本地保存的视频
  .get('/files/:filename', async ({ params: { filename }, set }) => {
    const filePath = resolve(import.meta.dir, '../../../storage/videos', filename)
    if (!existsSync(filePath)) {
      set.status = 404
      return { error: 'File not found' }
    }
    return Bun.file(filePath)
  })
