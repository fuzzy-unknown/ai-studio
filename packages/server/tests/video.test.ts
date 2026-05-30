import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { sql } from 'drizzle-orm'
import { Elysia } from 'elysia'
import { db } from '../src/db'
import { videoModule } from '../src/modules/video'
import { VideoService } from '../src/modules/video/service'

// 保存原始 API Key，测试期间移除以防止调用真实 DashScope API
let originalApiKey: string | undefined

beforeAll(async () => {
  // 移除 API Key — 验证层测试不受影响，通过验证的请求会在服务层 500
  // 这样既测试了验证逻辑，又不会产生真实任务和后台轮询
  originalApiKey = process.env.DASHSCOPE_API_KEY
  delete process.env.DASHSCOPE_API_KEY

  // 确保 tasks 表存在（与生产 schema 同步）
  await db.run(sql`CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id TEXT UNIQUE NOT NULL,
    model TEXT DEFAULT 'happyhorse-1.0-t2v',
    prompt TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING',
    resolution TEXT DEFAULT '720P',
    ratio TEXT DEFAULT '16:9',
    duration INTEGER DEFAULT 5,
    video_url TEXT,
    local_path TEXT,
    input_video_url TEXT,
    input_image_url TEXT,
    usage TEXT,
    cost REAL,
    error_message TEXT,
    request_id TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )`)
})

afterAll(() => {
  // 测试进程退出时恢复（虽然 bun:test 隔离进程，保持好习惯）
  if (originalApiKey !== undefined)
    process.env.DASHSCOPE_API_KEY = originalApiKey
})

// 轻量级 app 用于测试路由 + 验证
function createTestApp() {
  return new Elysia()
    .onError(({ code, error, status }) => {
      switch (code) {
        case 'VALIDATION':
          return status(400, { error: 'Validation Error', details: error.all?.map((e: any) => e.message) })
        case 'NOT_FOUND':
          return status(404, { error: 'Not Found' })
        default:
          return status(500, { error: String(error) })
      }
    })
    .use(videoModule)
}

function postRequest(body: any) {
  return new Request('http://localhost/api/video/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/video/generate — 基础验证', () => {
  const app = createTestApp()

  it('prompt 为空时返回 400', async () => {
    const res = await app.handle(postRequest({ prompt: '' }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBeDefined()
  })

  it('body 缺失时返回 400', async () => {
    const res = await app.handle(postRequest({}))
    expect(res.status).toBe(400)
  })

  it('resolution 无效时返回 400', async () => {
    const res = await app.handle(postRequest({ prompt: 'test', resolution: '480P' }))
    expect(res.status).toBe(400)
  })

  it('duration 超出范围时返回 400', async () => {
    const res = await app.handle(postRequest({ prompt: 'test', duration: 20 }))
    expect(res.status).toBe(400)
  })

  it('ratio 无效时返回 400', async () => {
    const res = await app.handle(postRequest({ prompt: 'test', ratio: '2:1' }))
    expect(res.status).toBe(400)
  })
})

describe('POST /api/video/generate — 模型专属必填字段校验', () => {
  const app = createTestApp()

  it('i2v 模型缺少 imageUrl 时返回 400', async () => {
    const res = await app.handle(postRequest({ prompt: 'test', model: 'happyhorse-1.0-i2v' }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('imageUrl')
  })

  it('r2v 模型缺少 imageUrls 时返回 400', async () => {
    const res = await app.handle(postRequest({ prompt: 'test', model: 'happyhorse-1.0-r2v' }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('imageUrls')
  })

  it('r2v 模型 imageUrls 为空数组时返回 400', async () => {
    const res = await app.handle(postRequest({ prompt: 'test', model: 'happyhorse-1.0-r2v', imageUrls: [] }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('imageUrls')
  })

  it('video-edit 模型缺少 videoUrl 时返回 400', async () => {
    const res = await app.handle(postRequest({ prompt: 'test', model: 'happyhorse-1.0-video-edit' }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('videoUrl')
  })
})

describe('POST /api/video/generate — imageUrls 数量校验', () => {
  const app = createTestApp()

  it('r2v 模型 imageUrls 超过 9 张时返回 400', async () => {
    const urls = Array.from({ length: 10 }, (_, i) => `https://example.com/img${i}.jpg`)
    const res = await app.handle(postRequest({ prompt: 'test', model: 'happyhorse-1.0-r2v', imageUrls: urls }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('1-9')
  })

  it('video-edit 模型 imageUrls 超过 5 张时返回 400', async () => {
    const urls = Array.from({ length: 6 }, (_, i) => `https://example.com/img${i}.jpg`)
    const res = await app.handle(postRequest({
      prompt: 'test',
      model: 'happyhorse-1.0-video-edit',
      videoUrl: 'https://example.com/video.mp4',
      imageUrls: urls,
    }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('0-5')
  })

  it('r2v 模型 imageUrls 恰好 9 张时验证通过（500=服务层错误，非 400=验证通过）', async () => {
    const urls = Array.from({ length: 9 }, (_, i) => `https://example.com/img${i}.jpg`)
    const res = await app.handle(postRequest({ prompt: 'test', model: 'happyhorse-1.0-r2v', imageUrls: urls }))
    expect(res.status).not.toBe(400)
  })

  it('video-edit 模型 imageUrls 恰好 5 张时验证通过', async () => {
    const urls = Array.from({ length: 5 }, (_, i) => `https://example.com/img${i}.jpg`)
    const res = await app.handle(postRequest({
      prompt: 'test',
      model: 'happyhorse-1.0-video-edit',
      videoUrl: 'https://example.com/video.mp4',
      imageUrls: urls,
    }))
    expect(res.status).not.toBe(400)
  })
})

describe('POST /api/video/generate — seed / audioSetting 验证', () => {
  const app = createTestApp()

  it('seed 为负数时返回 400', async () => {
    const res = await app.handle(postRequest({ prompt: 'test', seed: -1 }))
    expect(res.status).toBe(400)
  })

  it('seed 超过最大值时返回 400', async () => {
    const res = await app.handle(postRequest({ prompt: 'test', seed: 2147483648 }))
    expect(res.status).toBe(400)
  })

  it('audioSetting 无效时返回 400', async () => {
    const res = await app.handle(postRequest({ prompt: 'test', audioSetting: 'invalid' }))
    expect(res.status).toBe(400)
  })

  it('seed 边界值 0 验证通过', async () => {
    const res = await app.handle(postRequest({ prompt: 'test', seed: 0 }))
    expect(res.status).not.toBe(400)
  })

  it('seed 边界值 2147483647 验证通过', async () => {
    const res = await app.handle(postRequest({ prompt: 'test', seed: 2147483647 }))
    expect(res.status).not.toBe(400)
  })
})

describe('POST /api/video/generate — duration 边界值', () => {
  const app = createTestApp()

  it('duration 边界值 3 验证通过', async () => {
    const res = await app.handle(postRequest({ prompt: 'test', duration: 3 }))
    expect(res.status).not.toBe(400)
  })

  it('duration 边界值 15 验证通过', async () => {
    const res = await app.handle(postRequest({ prompt: 'test', duration: 15 }))
    expect(res.status).not.toBe(400)
  })

  it('duration 边界值 2 验证通过（万相2.7 支持）', async () => {
    const res = await app.handle(postRequest({ prompt: 'test', duration: 2 }))
    expect(res.status).not.toBe(400)
  })

  it('duration 小于最小值时返回 400', async () => {
    const res = await app.handle(postRequest({ prompt: 'test', duration: 1 }))
    expect(res.status).toBe(400)
  })

  it('duration 大于最大值时返回 400', async () => {
    const res = await app.handle(postRequest({ prompt: 'test', duration: 16 }))
    expect(res.status).toBe(400)
  })
})

describe('GET /api/video/tasks/:taskId', () => {
  const app = createTestApp()

  it('不存在的 taskId 返回 404', async () => {
    const res = await app.handle(new Request('http://localhost/api/video/tasks/non-existent-id'))
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toBe('Task not found')
  })
})

describe('VideoService — 单元测试', () => {
  it('DASHSCOPE_API_KEY 未设置时抛出异常', async () => {
    // beforeAll 已删除 key，此处验证行为正确
    try {
      await VideoService.createTask({ prompt: 'test' })
      expect.unreachable('Should have thrown')
    }
    catch (err) {
      expect((err as Error).message).toContain('DASHSCOPE_API_KEY')
    }
  })

  it('正确识别终止状态', () => {
    expect(VideoService.isTerminal('SUCCEEDED')).toBe(true)
    expect(VideoService.isTerminal('FAILED')).toBe(true)
    expect(VideoService.isTerminal('UNKNOWN')).toBe(true)
    expect(VideoService.isTerminal('CANCELED')).toBe(true)
    expect(VideoService.isTerminal('PENDING')).toBe(false)
    expect(VideoService.isTerminal('RUNNING')).toBe(false)
  })
})
