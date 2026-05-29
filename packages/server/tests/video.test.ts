import { beforeAll, describe, expect, it } from 'bun:test'
import { sql } from 'drizzle-orm'
import { Elysia } from 'elysia'
import { db } from '../src/db'
import { videoModule } from '../src/modules/video'
import { VideoService } from '../src/modules/video/service'

// 确保 tasks 表存在
beforeAll(async () => {
  await db.run(sql`CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id TEXT UNIQUE NOT NULL,
    prompt TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING',
    resolution TEXT DEFAULT '720P',
    ratio TEXT DEFAULT '16:9',
    duration INTEGER DEFAULT 5,
    video_url TEXT,
    error_message TEXT,
    request_id TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )`)
})

// 轻量级 app 用于测试路由 + 验证
function createTestApp() {
  return new Elysia()
    .onError(({ code, error, status }) => {
      switch (code) {
        case 'VALIDATION':
          return status(400, { error: 'Validation Error', details: error.all.map((e: any) => e.message) })
        case 'NOT_FOUND':
          return status(404, { error: 'Not Found' })
        default:
          return status(500, { error: String(error) })
      }
    })
    .use(videoModule)
}

describe('POST /api/video/generate', () => {
  const app = createTestApp()

  it('should return validation error when prompt is empty', async () => {
    const res = await app.handle(new Request('http://localhost/api/video/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: '' }),
    }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBeDefined()
  })

  it('should return validation error when body is missing', async () => {
    const res = await app.handle(new Request('http://localhost/api/video/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    }))
    expect(res.status).toBe(400)
  })

  it('should return validation error when resolution is invalid', async () => {
    const res = await app.handle(new Request('http://localhost/api/video/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'test', resolution: '480P' }),
    }))
    expect(res.status).toBe(400)
  })

  it('should return validation error when duration is out of range', async () => {
    const res = await app.handle(new Request('http://localhost/api/video/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'test', duration: 20 }),
    }))
    expect(res.status).toBe(400)
  })

  it('should return validation error when ratio is invalid', async () => {
    const res = await app.handle(new Request('http://localhost/api/video/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'test', ratio: '2:1' }),
    }))
    expect(res.status).toBe(400)
  })
})

describe('GET /api/video/tasks/:taskId', () => {
  const app = createTestApp()

  it('should return 404 for non-existent task', async () => {
    const res = await app.handle(new Request('http://localhost/api/video/tasks/non-existent-id'))
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toBe('Task not found')
  })
})

describe('VideoService', () => {
  it('should throw when DASHSCOPE_API_KEY is not set', async () => {
    const originalKey = process.env.DASHSCOPE_API_KEY
    delete process.env.DASHSCOPE_API_KEY

    try {
      await VideoService.createTask({ prompt: 'test' })
      expect.unreachable('Should have thrown')
    }
    catch (err) {
      expect((err as Error).message).toContain('DASHSCOPE_API_KEY')
    }
    finally {
      if (originalKey)
        process.env.DASHSCOPE_API_KEY = originalKey
    }
  })

  it('should correctly identify terminal states', () => {
    expect(VideoService.isTerminal('SUCCEEDED')).toBe(true)
    expect(VideoService.isTerminal('FAILED')).toBe(true)
    expect(VideoService.isTerminal('UNKNOWN')).toBe(true)
    expect(VideoService.isTerminal('CANCELED')).toBe(true)
    expect(VideoService.isTerminal('PENDING')).toBe(false)
    expect(VideoService.isTerminal('RUNNING')).toBe(false)
  })
})
