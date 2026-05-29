import { sql } from 'drizzle-orm'
import { int, sqliteTable, text } from 'drizzle-orm/sqlite-core'

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
  errorMessage: text('error_message'),
  requestId: text('request_id'),
  createdAt: text('created_at').default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').default(sql`(datetime('now'))`),
})

export type Task = typeof tasks.$inferSelect
export type NewTask = typeof tasks.$inferInsert
