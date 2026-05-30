import { Database } from 'bun:sqlite'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import * as schema from './schema'

const sqlite = new Database('ai-studio.db', { create: true })
sqlite.run('PRAGMA journal_mode = WAL')

// 自动建表
sqlite.run(`
  CREATE TABLE IF NOT EXISTS tasks (
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
  )
`)

// 兼容旧表：追加缺失的列
try {
  sqlite.run('ALTER TABLE tasks ADD COLUMN model TEXT DEFAULT \'happyhorse-1.0-t2v\'')
}
catch {}
try {
  sqlite.run('ALTER TABLE tasks ADD COLUMN input_video_url TEXT')
}
catch {}
try {
  sqlite.run('ALTER TABLE tasks ADD COLUMN input_image_url TEXT')
}
catch {}
try {
  sqlite.run('ALTER TABLE tasks ADD COLUMN usage TEXT')
}
catch {}
try {
  sqlite.run('ALTER TABLE tasks ADD COLUMN cost REAL')
}
catch {}
try {
  sqlite.run('ALTER TABLE tasks ADD COLUMN size TEXT DEFAULT NULL')
}
catch {}
try {
  sqlite.run('ALTER TABLE tasks ADD COLUMN negative_prompt TEXT DEFAULT NULL')
}
catch {}
try {
  sqlite.run('ALTER TABLE tasks ADD COLUMN n INTEGER DEFAULT 1')
}
catch {}
try {
  sqlite.run('ALTER TABLE tasks ADD COLUMN prompt_extend INTEGER DEFAULT 1')
}
catch {}
try {
  sqlite.run('ALTER TABLE tasks ADD COLUMN type TEXT DEFAULT \'video\'')
}
catch {}
// 迁移：已有数据按 model 设置 type
try {
  sqlite.run('UPDATE tasks SET type = \'image\' WHERE type = \'video\' AND model LIKE \'qwen-image%\'')
}
catch {}
// 迁移：videoUrl/localPath 统一为 JSON 数组格式
try {
  sqlite.run('UPDATE tasks SET video_url = json_array(video_url) WHERE video_url IS NOT NULL AND video_url NOT LIKE \'[%\'')
}
catch {}
try {
  sqlite.run('UPDATE tasks SET local_path = json_array(local_path) WHERE local_path IS NOT NULL AND local_path NOT LIKE \'[%\'')
}
catch {}

function safeParseJson(value: string | null): any {
  if (!value)
    return null
  try {
    return JSON.parse(value)
  }
  catch {
    return value
  }
}

function inferInputMediaType(model: string | null, url: string, index: number): string {
  if (model === 'happyhorse-1.0-video-edit')
    return 'reference_image'
  if (model === 'happyhorse-1.0-r2v')
    return 'reference_image'
  if (model === 'happyhorse-1.0-i2v')
    return 'first_frame'
  if (model?.startsWith('qwen-image'))
    return 'input_image'
  if (url.startsWith('data:audio') || /\.(?:mp3|wav)(?:\?|$)/i.test(url))
    return 'driving_audio'
  if (url.startsWith('data:video') || /\.(?:mp4|mov)(?:\?|$)/i.test(url))
    return 'first_clip'
  return index === 1 ? 'last_frame' : 'first_frame'
}

// 迁移：input_image_url 统一规范化为 { type, url }[]
try {
  const inputRows = sqlite
    .query<{ id: number, model: string | null, input_image_url: string | null }, []>(
      'SELECT id, model, input_image_url FROM tasks WHERE input_image_url IS NOT NULL',
    )
    .all()
  const updateInput = sqlite.prepare('UPDATE tasks SET input_image_url = ? WHERE id = ?')
  for (const row of inputRows) {
    const parsed = safeParseJson(row.input_image_url)
    const rawItems = Array.isArray(parsed) ? parsed : [parsed]
    const media = rawItems
      .map((item, index) => {
        if (typeof item === 'string')
          return { type: inferInputMediaType(row.model, item, index), url: item }
        if (item && typeof item === 'object' && typeof item.url === 'string') {
          return {
            type: typeof item.type === 'string' ? item.type : inferInputMediaType(row.model, item.url, index),
            url: item.url,
          }
        }
        return null
      })
      .filter(Boolean)
    updateInput.run(JSON.stringify(media), row.id)
  }
}
catch {}

// 定价配置表
sqlite.run(`
  CREATE TABLE IF NOT EXISTS pricing (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    model TEXT NOT NULL,
    resolution TEXT NOT NULL,
    official_price REAL NOT NULL,
    markup REAL NOT NULL DEFAULT 1.0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )
`)

// 唯一约束：每个模型+分辨率组合唯一
try {
  sqlite.run('CREATE UNIQUE INDEX IF NOT EXISTS idx_pricing_model_res ON pricing(model, resolution)')
}
catch {}

// 种子数据：增量插入（INSERT OR IGNORE 保证幂等，已存在的条目不会重复）
const insert = sqlite.prepare(
  'INSERT OR IGNORE INTO pricing (model, resolution, official_price, markup) VALUES (?, ?, ?, ?)',
)
// HappyHorse 视频模型定价（元/秒）
const videoModels = [
  'happyhorse-1.0-t2v',
  'happyhorse-1.0-i2v',
  'happyhorse-1.0-r2v',
  'happyhorse-1.0-video-edit',
]
for (const model of videoModels) {
  insert.run(model, '720P', 0.9, 1.0)
  insert.run(model, '1080P', 1.6, 1.0)
}
// 万相2.7 图生视频定价（元/秒）
insert.run('wan2.7-i2v-2026-04-25', '720P', 0.6, 1.0)
insert.run('wan2.7-i2v-2026-04-25', '1080P', 1.0, 1.0)
// 千问文生图模型定价（元/张）
const imagePricing: [string, string, number][] = [
  ['qwen-image-2.0-pro', '2048*2048', 0.5],
  ['qwen-image-2.0', '2048*2048', 0.2],
  ['qwen-image-max', '1664*928', 0.5],
  ['qwen-image-plus', '1664*928', 0.2],
  ['qwen-image', '1664*928', 0.25],
]
for (const [model, size, price] of imagePricing) {
  insert.run(model, size, price, 1.0)
}
// 千问图像编辑模型定价（元/张）
const editPricing: [string, number][] = [
  ['qwen-image-edit-max', 0.5],
  ['qwen-image-edit-plus', 0.2],
  ['qwen-image-edit', 0.3],
]
for (const [model, price] of editPricing) {
  insert.run(model, '1024*1024', price, 1.0)
}

export const db = drizzle(sqlite, { schema })
