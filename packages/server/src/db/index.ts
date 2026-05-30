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

// 种子数据：HappyHorse 官方价格（仅在表为空时插入）
const existingPricing = sqlite.prepare('SELECT COUNT(*) as cnt FROM pricing').get() as any
if (existingPricing.cnt === 0) {
  const models = [
    'happyhorse-1.0-t2v',
    'happyhorse-1.0-i2v',
    'happyhorse-1.0-r2v',
    'happyhorse-1.0-video-edit',
  ]
  const insert = sqlite.prepare(
    'INSERT OR IGNORE INTO pricing (model, resolution, official_price, markup) VALUES (?, ?, ?, ?)',
  )
  for (const model of models) {
    insert.run(model, '720P', 0.9, 1.0)
    insert.run(model, '1080P', 1.6, 1.0)
  }
}

export const db = drizzle(sqlite, { schema })
