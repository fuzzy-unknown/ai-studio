import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { Elysia } from 'elysia'
import { logger } from '../../utils/logger'
import { getModel, isQwenImageModel } from '../task/model-registry'
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
    response: { 200: 'imageGenerateResponse' },
    beforeHandle: ({ body, set }) => {
      const b = body as any
      const model = b.model || 'qwen-image-2.0-pro'

      if (!isQwenImageModel(model)) {
        set.status = 400
        return { error: `Invalid model: ${model}. Must be a qwen-image model.` }
      }

      const modelDef = getModel(model)
      if (modelDef) {
        const err = modelDef.validate(b)
        if (err) {
          set.status = 400
          return { error: err }
        }
      }
      else {
        // 未在注册表中的 qwen-image 变体（如日期快照），只做基础校验
        if (b.imageUrls && b.imageUrls.length > 3) {
          set.status = 400
          return { error: 'imageUrls must contain 1-3 images' }
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
    logger.info({ taskId }, '[SSE-Image] Client connected')

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder()
        const send = (data: any) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
        }

        let lastStatus = ''
        let ticks = 0

        while (ticks < 300) {
          ticks++
          const task = await ImageService.getTaskByTaskId(taskId)

          if (!task) {
            send({ status: 'ERROR', error: 'Task not found' })
            break
          }

          if (task.status !== lastStatus) {
            lastStatus = task.status
            send({
              status: task.status,
              // 图片结果：优先本地路径，否则远程 URL
              video_url: task.localPath ? `/api/image/files/${taskId}.png` : task.videoUrl || null,
              error: task.errorMessage || null,
            })
          }

          if (ImageService.isTerminal(task.status))
            break

          await Bun.sleep(2000)
        }

        send({ status: 'DONE' })
        logger.info({ taskId }, '[SSE-Image] Stream closed')
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
  .get('/files/:filename', async ({ params: { filename }, set }) => {
    const filePath = resolve(import.meta.dir, '../../../storage/images', filename)
    if (!existsSync(filePath)) {
      set.status = 404
      return { error: 'File not found' }
    }
    return Bun.file(filePath)
  })
