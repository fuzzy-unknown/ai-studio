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

export const imageModule = new Elysia({ prefix: '/api/image', name: 'module:image', tags: ['图片生成'] })
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
    detail: {
      summary: '创建图片生成任务',
      description: '提交图片生成请求，支持文生图和图生图（图片编辑）模式。\n\n- 同步模型（2.0 系列、edit 系列）：请求阻塞直到生成完成，返回带 `sync-` 前缀的 task_id\n- 异步模型（max / plus）：提交后立即返回 task_id，通过 SSE 或轮询获取结果\n- 默认模型为 `qwen-image-2.0-pro`',
    },
  })
  .get('/tasks', () => ImageService.getAllTasks(), {
    response: { 200: 'imageTaskListResponse' },
    detail: {
      summary: '获取图片任务列表',
      description: '查询所有图片生成任务，按创建时间降序排列。',
    },
  })
  .get('/usage/stats', () => ImageService.getUsageStats(), {
    response: { 200: 'imageUsageStatsResponse' },
    detail: {
      summary: '获取图片用量统计',
      description: '获取图片任务的总时长（秒）、总费用（元）和任务数量。',
    },
  })
  .get('/tasks/:taskId', async ({ params: { taskId }, set }) => {
    const task = await ImageService.getTaskByTaskId(taskId)
    if (!task) {
      set.status = 404
      return { error: 'Task not found' }
    }
    return task
  }, {
    detail: {
      summary: '获取图片任务详情',
      description: '根据任务 ID 获取图片任务的完整信息。',
    },
  })
  .get('/tasks/:taskId/events', ({ params: { taskId } }) => {
    return createSSEStream(taskId, {
      resolveMediaUrl: resolveTaskMediaUrl,
      logPrefix: '[SSE-Image]',
    })
  }, {
    detail: {
      summary: '订阅图片任务事件流 (SSE)',
      description: '以 Server-Sent Events 方式实时推送图片任务状态变更。\n任务完成后推送包含图片 URL 的事件，进入终态后自动关闭连接。',
    },
  })
  .get('/files/:filename', async ({ params: { filename }, set }) => {
    const filePath = resolve(import.meta.dir, '../../../storage/images', filename)
    if (!existsSync(filePath)) {
      set.status = 404
      return { error: 'File not found' }
    }
    return Bun.file(filePath)
  }, {
    detail: {
      summary: '获取图片文件',
      description: '根据文件名获取本地存储的图片文件（支持 jpg / webp / png 格式）。文件名可通过任务详情中的 localPath 字段获取。',
    },
  })
