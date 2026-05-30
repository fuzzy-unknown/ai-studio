import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { Elysia } from 'elysia'
import { imageModule } from '../src/modules/image'

let originalApiKey: string | undefined

beforeAll(() => {
  originalApiKey = process.env.DASHSCOPE_API_KEY
  delete process.env.DASHSCOPE_API_KEY
})

afterAll(() => {
  if (originalApiKey !== undefined)
    process.env.DASHSCOPE_API_KEY = originalApiKey
})

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
    .use(imageModule)
}

function postRequest(body: any) {
  return new Request('http://localhost/api/image/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function urls(count: number) {
  return Array.from({ length: count }, (_, i) => `https://example.com/image-${i}.png`)
}

describe('POST /api/image/generate — 基础边界', () => {
  const app = createTestApp()

  it('prompt 为空时返回 400', async () => {
    const res = await app.handle(postRequest({ prompt: '' }))
    expect(res.status).toBe(400)
  })

  it('seed 为 0 时验证通过', async () => {
    const res = await app.handle(postRequest({ prompt: 'test', seed: 0 }))
    expect(res.status).not.toBe(400)
  })

  it('seed 超出上限时返回 400', async () => {
    const res = await app.handle(postRequest({ prompt: 'test', seed: 2147483648 }))
    expect(res.status).toBe(400)
  })

  it('negativePrompt 超过 500 字符时返回 400', async () => {
    const res = await app.handle(postRequest({ prompt: 'test', negativePrompt: 'x'.repeat(501) }))
    expect(res.status).toBe(400)
  })
})

describe('POST /api/image/generate — qwen-image-2.0 文档边界', () => {
  const app = createTestApp()

  it('n=6 验证通过', async () => {
    const res = await app.handle(postRequest({ prompt: 'test', model: 'qwen-image-2.0-pro', n: 6 }))
    expect(res.status).not.toBe(400)
  })

  it('n=7 返回 400', async () => {
    const res = await app.handle(postRequest({ prompt: 'test', model: 'qwen-image-2.0-pro', n: 7 }))
    expect(res.status).toBe(400)
  })

  it('推荐大尺寸 2688*1536 验证通过', async () => {
    const res = await app.handle(postRequest({ prompt: 'test', model: 'qwen-image-2.0-pro', size: '2688*1536' }))
    expect(res.status).not.toBe(400)
  })

  it('总像素低于 512*512 时返回 400', async () => {
    const res = await app.handle(postRequest({ prompt: 'test', model: 'qwen-image-2.0-pro', size: '511*511' }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('512*512')
  })

  it('编辑模式输入 3 张图验证通过', async () => {
    const res = await app.handle(postRequest({ prompt: 'test', model: 'qwen-image-2.0-pro', imageUrls: urls(3) }))
    expect(res.status).not.toBe(400)
  })

  it('编辑模式输入 4 张图返回 400', async () => {
    const res = await app.handle(postRequest({ prompt: 'test', model: 'qwen-image-2.0-pro', imageUrls: urls(4) }))
    expect(res.status).toBe(400)
  })
})

describe('POST /api/image/generate — qwen-image-max/plus 文档边界', () => {
  const app = createTestApp()

  it('qwen-image-plus 只允许 n=1', async () => {
    const res = await app.handle(postRequest({ prompt: 'test', model: 'qwen-image-plus', n: 2 }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('1-1')
  })

  it('qwen-image-plus 只允许官方枚举尺寸', async () => {
    const res = await app.handle(postRequest({ prompt: 'test', model: 'qwen-image-plus', size: '2048*2048' }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('supported')
  })

  it('qwen-image-plus 支持 1664*928', async () => {
    const res = await app.handle(postRequest({ prompt: 'test', model: 'qwen-image-plus', size: '1664*928' }))
    expect(res.status).not.toBe(400)
  })

  it('qwen-image 官方模型 ID 支持异步文生图参数', async () => {
    const res = await app.handle(postRequest({ prompt: 'test', model: 'qwen-image', size: '1664*928', n: 1 }))
    expect(res.status).not.toBe(400)
  })

  it('qwen-image-max prompt 超过 800 字符返回 400', async () => {
    const res = await app.handle(postRequest({ prompt: 'x'.repeat(801), model: 'qwen-image-max' }))
    expect(res.status).toBe(400)
  })
})

describe('POST /api/image/generate — 图像编辑文档边界', () => {
  const app = createTestApp()

  it('qwen-image-edit-max 缺少 imageUrls 返回 400', async () => {
    const res = await app.handle(postRequest({ prompt: 'test', model: 'qwen-image-edit-max' }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('imageUrls')
  })

  it('qwen-image-edit-max 支持输出 6 张图', async () => {
    const res = await app.handle(postRequest({ prompt: 'test', model: 'qwen-image-edit-max', imageUrls: urls(1), n: 6 }))
    expect(res.status).not.toBe(400)
  })

  it('qwen-image-edit-max 尺寸宽高不能低于 512', async () => {
    const res = await app.handle(postRequest({ prompt: 'test', model: 'qwen-image-edit-max', imageUrls: urls(1), size: '511*1024' }))
    expect(res.status).toBe(400)
  })

  it('qwen-image-edit 只支持 n=1', async () => {
    const res = await app.handle(postRequest({ prompt: 'test', model: 'qwen-image-edit', imageUrls: urls(1), n: 2 }))
    expect(res.status).toBe(400)
  })

  it('qwen-image-edit 不支持 size', async () => {
    const res = await app.handle(postRequest({ prompt: 'test', model: 'qwen-image-edit', imageUrls: urls(1), size: '1024*1024' }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('size')
  })
})
