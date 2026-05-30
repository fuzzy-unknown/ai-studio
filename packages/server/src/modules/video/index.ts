import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { Elysia } from 'elysia'
import { logger } from '../../utils/logger'
import { getModel } from '../task/model-registry'
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
    response: { 200: 'generateResponse' },
    beforeHandle: ({ body, set }) => {
      const b = body as any
      const model = b.model || 'happyhorse-1.0-t2v'
      const modelDef = getModel(model)
      if (!modelDef || modelDef.category !== 'video') {
        set.status = 400
        return { error: `Invalid video model: ${model}` }
      }
      const err = modelDef.validate(b)
      if (err) {
        set.status = 400
        return { error: err }
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
    logger.info({ taskId }, '[SSE] Client connected')

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder()
        const send = (data: any) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
        }

        let lastStatus = ''
        let ticks = 0

        while (ticks < 300) { // ~10 min max
          ticks++
          const task = await VideoService.getTaskByTaskId(taskId)

          if (!task) {
            send({ status: 'ERROR', error: 'Task not found' })
            break
          }

          if (task.status !== lastStatus) {
            lastStatus = task.status
            send({
              status: task.status,
              video_url: task.localPath ? `/api/video/files/${taskId}.mp4` : task.videoUrl || null,
              error: task.errorMessage || null,
            })
          }

          if (VideoService.isTerminal(task.status))
            break

          await Bun.sleep(2000)
        }

        send({ status: 'DONE' })
        logger.info({ taskId }, '[SSE] Stream closed')
        controller.close()
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
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
