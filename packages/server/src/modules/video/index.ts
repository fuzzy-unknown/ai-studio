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

export const videoModule = new Elysia({ prefix: '/api/video', name: 'module:video', tags: ['视频生成'] })
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
    detail: {
      summary: '创建视频生成任务',
      description: '提交视频生成请求，支持文生视频 (t2v)、图生视频 (i2v)、参考生视频 (r2v)、视频编辑 (edit)、万相2.7 图生视频等模式。\n\n- 异步模型：提交后立即返回 task_id，通过 SSE 或轮询获取结果\n- 默认模型为 `happyhorse-1.0-t2v`',
    },
  })
  .get('/tasks', () => VideoService.getAllTasks(), {
    response: { 200: 'taskListResponse' },
    detail: {
      summary: '获取视频任务列表',
      description: '查询所有视频生成任务，按创建时间降序排列。',
    },
  })
  .get('/usage/stats', () => VideoService.getUsageStats(), {
    response: { 200: 'usageStatsResponse' },
    detail: {
      summary: '获取视频用量统计',
      description: '获取视频任务的总时长（秒）、总费用（元）和任务数量。',
    },
  })
  .get('/tasks/:taskId', async ({ params: { taskId }, set }) => {
    const task = await VideoService.getTaskByTaskId(taskId)
    if (!task) {
      set.status = 404
      return { error: 'Task not found' }
    }
    return task
  }, {
    detail: {
      summary: '获取视频任务详情',
      description: '根据任务 ID 获取视频任务的完整信息。',
    },
  })
  .get('/tasks/:taskId/events', ({ params: { taskId } }) => {
    return createSSEStream(taskId, {
      resolveMediaUrl: resolveTaskMediaUrl,
      logPrefix: '[SSE]',
    })
  }, {
    detail: {
      summary: '订阅视频任务事件流 (SSE)',
      description: '以 Server-Sent Events 方式实时推送视频任务状态变更。\n任务完成后推送包含视频 URL 的事件，进入终态后自动关闭连接。',
    },
  })
  .get('/files/:filename', async ({ params: { filename }, set }) => {
    const filePath = resolve(import.meta.dir, '../../../storage/videos', filename)
    if (!existsSync(filePath)) {
      set.status = 404
      return { error: 'File not found' }
    }
    return Bun.file(filePath)
  }, {
    detail: {
      summary: '获取视频文件',
      description: '根据文件名获取本地存储的视频文件（mp4 格式）。文件名可通过任务详情中的 localPath 字段获取。',
    },
  })
