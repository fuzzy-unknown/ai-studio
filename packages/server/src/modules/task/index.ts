/**
 * 统一任务端点 — 合并 video/image 两个模块的公共路由
 * 提供单一的 GET /api/tasks、GET /api/tasks/:taskId、
 * GET /api/tasks/:taskId/events、DELETE /api/tasks/:taskId、
 * POST /api/tasks/:taskId/cancel、GET /api/usage/stats 入口
 */
import { Elysia, t } from 'elysia'
import { logger } from '../../utils/logger'
import { cancelTask, deleteTask, getAllTasks, getTaskByTaskId, getUsageStats, resolveTaskMediaUrl } from './shared'
import { createSSEStream } from './sse'

export const taskModule = new Elysia({ prefix: '/api', name: 'module:task' })
  .onBeforeHandle(({ request }) => {
    logger.info({ method: request.method, url: request.url }, '[API-Task] Incoming request')
  })
  .get('/tasks', ({ query }) => getAllTasks({
    limit: query.limit ? Number(query.limit) : undefined,
    offset: query.offset ? Number(query.offset) : undefined,
    type: query.type === 'image' || query.type === 'video' ? query.type : undefined,
  }), {
    query: t.Object({
      limit: t.Optional(t.String()),
      offset: t.Optional(t.String()),
      type: t.Optional(t.Union([t.Literal('video'), t.Literal('image'), t.Literal('all')])),
    }),
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
      resolveMediaUrl: resolveTaskMediaUrl,
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
