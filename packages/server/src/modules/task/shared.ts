import type { Task } from '../../db/schema'
/**
 * 共享任务工具函数 — 供 video 和 image 模块复用
 */
import { existsSync } from 'node:fs'
import { unlink } from 'node:fs/promises'
import { resolve } from 'node:path'
import process from 'node:process'
import { desc, eq, sql } from 'drizzle-orm'
import { db } from '../../db'
import { tasks } from '../../db/schema'
import { logger } from '../../utils/logger'
import { isQwenImageModel } from './model-registry'

export const TERMINAL_STATES = new Set(['SUCCEEDED', 'FAILED', 'UNKNOWN', 'CANCELED'])

export function parseMediaUrls(value: string | null): string[] {
  if (!value)
    return []
  return JSON.parse(value) as string[]
}

export function isImageTask(task: Pick<Task, 'type' | 'model'>): boolean {
  if (task.type === 'image')
    return true
  if (task.type === 'video')
    return false
  return task.model ? isQwenImageModel(task.model) : false
}

export function resolveTaskMediaUrl(task: Task): string | null {
  const localUrls = parseMediaUrls(task.localPath)
  const image = isImageTask(task)
  const prefix = image ? '/api/image/files/' : '/api/video/files/'

  if (localUrls.length > 0) {
    const urls = localUrls
      .map(path => path.split('/').pop())
      .filter((filename): filename is string => !!filename)
      .map(filename => `${prefix}${filename}`)
    if (urls.length === 0)
      return null
    return urls.length === 1 ? urls[0] : JSON.stringify(urls)
  }

  return task.videoUrl || null
}

export function getApiKey(): string {
  const key = process.env.DASHSCOPE_API_KEY
  if (!key)
    throw new Error('DASHSCOPE_API_KEY is not set')
  return key
}

export function isTerminal(status: string): boolean {
  return TERMINAL_STATES.has(status)
}

export async function getAllTasks(options: { limit?: number, offset?: number, type?: 'video' | 'image' } = {}): Promise<Task[]> {
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 200)
  const offset = Math.max(options.offset ?? 0, 0)
  const query = db.select().from(tasks).orderBy(desc(tasks.createdAt)).limit(limit).offset(offset)
  if (options.type)
    return query.where(eq(tasks.type, options.type)).all()
  return query.all()
}

export async function getTaskByTaskId(taskId: string): Promise<Task | undefined> {
  return db.select().from(tasks).where(eq(tasks.taskId, taskId)).get()
}

export async function deleteTask(taskId: string): Promise<boolean> {
  const task = await getTaskByTaskId(taskId)
  if (!task)
    return false

  // 删除本地文件
  const localPaths = parseMediaUrls(task.localPath)
  const pathsToDelete = localPaths.length > 0
    ? localPaths.map(path => resolve(import.meta.dir, '../../../', path))
    : [resolve(import.meta.dir, '../../../storage/videos', `${taskId}.mp4`)]

  for (const filePath of pathsToDelete) {
    if (existsSync(filePath)) {
      try {
        await unlink(filePath)
        logger.info({ taskId, filePath }, '[Task] Deleted local file')
      }
      catch (err) {
        logger.warn({ taskId, filePath, error: (err as Error).message }, '[Task] Failed to delete local file')
      }
    }
  }

  // 删除数据库记录
  await db.delete(tasks).where(eq(tasks.taskId, taskId))
  logger.info({ taskId }, '[Task] Deleted task record')
  return true
}

export async function cancelTask(taskId: string): Promise<Task | null> {
  const task = await getTaskByTaskId(taskId)
  if (!task)
    return null

  // 只有进行中的任务可以取消
  if (TERMINAL_STATES.has(task.status))
    return null

  await db
    .update(tasks)
    .set({
      status: 'CANCELED',
      updatedAt: sql`(datetime('now'))`,
    })
    .where(eq(tasks.taskId, taskId))

  logger.info({ taskId }, '[Task] Task canceled')
  const updated = await getTaskByTaskId(taskId)
  return updated ?? null
}

export async function getUsageStats(): Promise<{ totalDuration: number, totalCost: number, taskCount: number }> {
  const result = db.get<{ task_count: number, total_cost: number }>(
    sql`SELECT COUNT(*) as task_count, COALESCE(SUM(cost), 0) as total_cost FROM tasks WHERE status = 'SUCCEEDED' AND cost IS NOT NULL`,
  )
  const taskCount = result?.task_count ?? 0
  const totalCost = Number((result?.total_cost ?? 0).toFixed(4))

  // 单独查询总时长（从 usage JSON 中提取 duration）
  let totalDuration = 0
  const succeededTasks = db.select({ usage: tasks.usage })
    .from(tasks)
    .where(sql`status = 'SUCCEEDED' AND usage IS NOT NULL`)
    .all()
  for (const task of succeededTasks) {
    try {
      const usage = JSON.parse(task.usage!)
      if (typeof usage.duration === 'number')
        totalDuration += usage.duration
    }
    catch {}
  }

  return { totalDuration, totalCost, taskCount }
}
