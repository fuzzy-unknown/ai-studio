import { sql } from 'drizzle-orm'
import { int, real, sqliteTable, text } from 'drizzle-orm/sqlite-core'

// 定价配置表：按模型 × 分辨率存储价格
export const pricing = sqliteTable('pricing', {
  id: int().primaryKey({ autoIncrement: true }),
  model: text('model').notNull(),           // 模型 ID，如 happyhorse-1.0-t2v
  resolution: text('resolution').notNull(),  // 分辨率，如 720P、1080P
  officialPrice: real('official_price').notNull(), // 官方单价（元/秒）
  markup: real('markup').notNull().default(1.0),   // 加价倍率，1.0 = 不加价
  // 实际单价 = officialPrice × markup
  createdAt: text('created_at').default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').default(sql`(datetime('now'))`),
})

export type Pricing = typeof pricing.$inferSelect
export type NewPricing = typeof pricing.$inferInsert

export const tasks = sqliteTable('tasks', {
  id: int().primaryKey({ autoIncrement: true }),
  taskId: text('task_id').notNull().unique(),
  model: text('model').default('happyhorse-1.0-t2v'),
  prompt: text('prompt').notNull(),
  status: text('status').notNull().default('PENDING'),
  resolution: text('resolution').default('720P'),
  ratio: text('ratio').default('16:9'),
  duration: int('duration').default(5),
  inputVideoUrl: text('input_video_url'),
  inputImageUrl: text('input_image_url'),
  videoUrl: text('video_url'),
  localPath: text('local_path'),
  usage: text('usage'),
  cost: real('cost'),
  errorMessage: text('error_message'),
  requestId: text('request_id'),
  createdAt: text('created_at').default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').default(sql`(datetime('now'))`),
})

export type Task = typeof tasks.$inferSelect
export type NewTask = typeof tasks.$inferInsert
