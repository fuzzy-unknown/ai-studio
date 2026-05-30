/**
 * 统一任务端点 — 合并 video/image 两个模块的公共路由
 * 提供单一的 GET /api/tasks、GET /api/tasks/:taskId、
 * GET /api/tasks/:taskId/events、DELETE /api/tasks/:taskId、
 * POST /api/tasks/:taskId/cancel、GET /api/usage/stats 入口
 */
import { Elysia, t } from 'elysia'
import { logger } from '../../utils/logger'
import { createSSEStream } from './sse'
import { cancelTask, deleteTask, getAllTasks, getTaskByTaskId, getUsageStats, parseMediaUrls } from './shared'

export const taskModule = new Elysia({ prefix: '/api', name: 'module:task' })
  .onBeforeHandle(({ request }) => {
    logger.info({ method: request.method, url: request.url }, '[API-Task] Incoming request')
  })
  .get('/tasks', () => getAllTasks(), {
    response: { 200: t.Array(t.Any()) },
  })
  .get('/tasks/:taskId', async ({ params: { taskId }, set }) => {
    const task = await getTaskByTaskId(taskId)
    if (!task) {
      set.status = 404
      return { error: 'Task not found' }
    }
    return task
  })
  .get('/tasks/:taskId/events', async ({ params: { taskId } }) => {
    return createSSEStream(taskId, {
      resolveMediaUrl: (task) => {
        // videoUrl/localPath 统一为 JSON 数组，解析出实际 URL 列表
        const isImage = task.model?.startsWith('qwen-image')
        if (task.localPath) {
          const localUrls = parseMediaUrls(task.localPath)
          // 将本地相对路径转为文件服务 URL
          const prefix = isImage ? '/api/image/files/' : '/api/video/files/'
          // 单文件直接返回第一个路径的 URL
          if (localUrls.length === 1) {
            const filename = localUrls[0].split('/').pop()
            return filename ? `${prefix}${filename}` : null
          }
          // 多文件返回 JSON 数组 URL
          return JSON.stringify(localUrls.map((p) => {
            const filename = p.split('/').pop()
            return filename ? `${prefix}${filename}` : null
          }).filter(Boolean))
        }
        // 无本地文件时返回远程 URL（已是 JSON 数组格式）
        return task.videoUrl || null
      },
      logPrefix: '[SSE-Task]',
    })
  })
  .delete('/tasks/:taskId', async ({ params: { taskId }, set }) => {
    const deleted = await deleteTask(taskId)
    if (!deleted) {
      set.status = 404
      return { error: 'Task not found' }
    }
    return { success: true }
  })
  .post('/tasks/:taskId/cancel', async ({ params: { taskId }, set }) => {
    const task = await cancelTask(taskId)
    if (!task) {
      set.status = 400
      return { error: 'Task not found or already in terminal state' }
    }
    return task
  })
  .get('/usage/stats', () => getUsageStats(), {
    response: {
      200: t.Object({
        totalDuration: t.Number(),
        totalCost: t.Number(),
        taskCount: t.Number(),
      }),
    },
  })
