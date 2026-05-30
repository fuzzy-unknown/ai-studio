/**
 * 统一任务端点 — 合并 video/image 两个模块的公共路由
 * 提供单一的 GET /api/models、GET /api/tasks、GET /api/tasks/:taskId、
 * GET /api/tasks/:taskId/events、DELETE /api/tasks/:taskId、
 * POST /api/tasks/:taskId/cancel、GET /api/usage/stats 入口
 */
import { Elysia, t } from 'elysia'
import { logger } from '../../utils/logger'
import { MODELS } from './model-registry'
import { cancelTask, deleteTask, getAllTasks, getTaskByTaskId, getUsageStats, resolveTaskMediaUrl } from './shared'
import { createSSEStream } from './sse'

export const taskModule = new Elysia({ prefix: '/api', name: 'module:task', tags: ['统一任务'] })
  .onBeforeHandle(({ request }) => {
    logger.info({ method: request.method, url: request.url }, '[API-Task] Incoming request')
  })
  .get('/models', () => {
    return Object.values(MODELS).map(m => ({
      id: m.id,
      category: m.category,
      subType: m.subType,
      label: m.label,
      apiMode: m.apiMode,
      capabilities: {
        hasRatio: m.hasRatio,
        hasDuration: m.hasDuration,
        hasInputVideo: m.hasInputVideo,
      },
      defaults: m.defaults,
    }))
  }, {
    detail: {
      summary: '获取支持的模型列表',
      description: '返回当前支持的所有模型及其分类、能力与默认参数。\n\n可通过 `category` 筛选大类（video / image），通过 `subType` 筛选具体类型：\n- 视频模型：t2v（文生视频）、i2v（图生视频）、r2v（参考生视频）、edit（视频编辑）、wan27-i2v（万相2.7 图生视频）\n- 图片模型：t2i（文生图）、i2i（图生图/图片编辑）\n\n`apiMode` 表示调用模式：async 需轮询/SSE 获取结果，sync 直接返回结果。',
    },
  })
  .get('/tasks', ({ query }) => getAllTasks({
    limit: query.limit ? Number(query.limit) : undefined,
    offset: query.offset ? Number(query.offset) : undefined,
    type: query.type === 'image' || query.type === 'video' ? query.type : undefined,
  }), {
    query: t.Object({
      limit: t.Optional(t.String({ description: '每页数量，默认 50' })),
      offset: t.Optional(t.String({ description: '偏移量，默认 0' })),
      type: t.Optional(t.Union([t.Literal('video'), t.Literal('image'), t.Literal('all')], { description: '按类型筛选：video | image | all' })),
    }),
    response: { 200: t.Array(t.Any()) },
    detail: {
      summary: '获取任务列表',
      description: '分页查询所有视频/图片任务，支持按类型筛选。返回任务对象数组。',
    },
  })
  .get('/tasks/:taskId', async ({ params: { taskId }, set }) => {
    const task = await getTaskByTaskId(taskId)
    if (!task) {
      set.status = 404
      return { error: 'Task not found' }
    }
    return task
  }, {
    detail: {
      summary: '获取任务详情',
      description: '根据任务 ID 获取单个任务的完整信息，包括状态、结果 URL、费用等。',
    },
  })
  .get('/tasks/:taskId/events', async ({ params: { taskId } }) => {
    return createSSEStream(taskId, {
      resolveMediaUrl: resolveTaskMediaUrl,
      logPrefix: '[SSE-Task]',
    })
  }, {
    detail: {
      summary: '订阅任务事件流 (SSE)',
      description: '以 Server-Sent Events 方式实时推送任务状态变更。\n每 2 秒轮询数据库检测状态变化，任务进入终态（SUCCEEDED / FAILED / CANCELED / UNKNOWN）后自动关闭连接。\n事件格式：`data: { "status": "...", "video_url": "...", "error": "..." }`',
    },
  })
  .delete('/tasks/:taskId', async ({ params: { taskId }, set }) => {
    const deleted = await deleteTask(taskId)
    if (!deleted) {
      set.status = 404
      return { error: 'Task not found' }
    }
    return { success: true }
  }, {
    detail: {
      summary: '删除任务',
      description: '根据任务 ID 删除任务记录及其关联的本地文件。',
    },
  })
  .post('/tasks/:taskId/cancel', async ({ params: { taskId }, set }) => {
    const task = await cancelTask(taskId)
    if (!task) {
      set.status = 400
      return { error: 'Task not found or already in terminal state' }
    }
    return task
  }, {
    detail: {
      summary: '取消任务',
      description: '取消进行中的任务。仅非终态（PENDING / RUNNING）的任务可取消，取消后状态变为 CANCELED。',
    },
  })
  .get('/usage/stats', () => getUsageStats(), {
    response: {
      200: t.Object({
        totalDuration: t.Number({ description: '所有任务的总时长（秒）' }),
        totalCost: t.Number({ description: '所有任务的总费用（元）' }),
        taskCount: t.Number({ description: '任务总数' }),
      }),
    },
    detail: {
      summary: '获取用量统计',
      description: '获取所有任务的总时长、总费用和任务数量。',
    },
  })
