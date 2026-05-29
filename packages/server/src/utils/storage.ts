import { mkdir } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { logger } from './logger'

const STORAGE_DIR = resolve(import.meta.dir, '../../storage/videos')

async function ensureDir() {
  await mkdir(STORAGE_DIR, { recursive: true })
}

export function getVideoPath(taskId: string): string {
  return join(STORAGE_DIR, `${taskId}.mp4`)
}

export function getVideoRelativePath(taskId: string): string {
  return `storage/videos/${taskId}.mp4`
}

export async function downloadVideo(url: string, taskId: string): Promise<string> {
  await ensureDir()
  const filePath = getVideoPath(taskId)

  logger.info({ taskId, url: url.slice(0, 80) }, '[Storage] Downloading video')

  const res = await fetch(url)
  if (!res.ok)
    throw new Error(`Failed to download video: ${res.status} ${res.statusText}`)

  const buffer = await res.arrayBuffer()
  await Bun.write(filePath, new Uint8Array(buffer))

  const sizeMB = (buffer.byteLength / 1024 / 1024).toFixed(2)
  logger.info({ taskId, path: filePath, sizeMB }, '[Storage] Video saved')

  return getVideoRelativePath(taskId)
}
