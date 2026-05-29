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

export const db = drizzle(sqlite, { schema })
