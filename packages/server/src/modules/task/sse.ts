/**
 * 共享 SSE 流实现 — 供 video 和 image 模块复用
 */
import type { Task } from '../../db/schema'
import { logger } from '../../utils/logger'
import { getTaskByTaskId, isTerminal } from './shared'

export interface SSEOptions {
  /** 解析媒体 URL：返回给客户端的 video_url 字段 */
  resolveMediaUrl: (task: Task) => string | null
  /** 日志前缀 */
  logPrefix: string
}

export function createSSEStream(taskId: string, options: SSEOptions): Response {
  logger.info({ taskId }, `${options.logPrefix} Client connected`)

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
        const task = await getTaskByTaskId(taskId)

        if (!task) {
          send({ status: 'ERROR', error: 'Task not found' })
          break
        }

        if (task.status !== lastStatus) {
          lastStatus = task.status
          send({
            status: task.status,
            video_url: options.resolveMediaUrl(task),
            error: task.errorMessage || null,
          })
        }

        if (isTerminal(task.status))
          break

        await Bun.sleep(2000)
      }

      send({ status: 'DONE' })
      logger.info({ taskId }, `${options.logPrefix} Stream closed`)
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
}
