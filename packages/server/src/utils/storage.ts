import { mkdir } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { logger } from './logger'

const VIDEO_DIR = resolve(import.meta.dir, '../../storage/videos')
const IMAGE_DIR = resolve(import.meta.dir, '../../storage/images')

async function ensureDir(dir: string) {
  await mkdir(dir, { recursive: true })
}

export function getVideoPath(taskId: string): string {
  return join(VIDEO_DIR, `${taskId}.mp4`)
}

export function getVideoRelativePath(taskId: string): string {
  return `storage/videos/${taskId}.mp4`
}

export function getImagePath(taskId: string): string {
  return join(IMAGE_DIR, `${taskId}.png`)
}

export function getImageRelativePath(taskId: string): string {
  return `storage/images/${taskId}.png`
}

export async function downloadVideo(url: string, taskId: string): Promise<string> {
  await ensureDir(VIDEO_DIR)
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

export async function downloadImage(url: string, taskId: string): Promise<string> {
  await ensureDir(IMAGE_DIR)
  const filePath = getImagePath(taskId)

  logger.info({ taskId, url: url.slice(0, 80) }, '[Storage] Downloading image')

  const res = await fetch(url)
  if (!res.ok)
    throw new Error(`Failed to download image: ${res.status} ${res.statusText}`)

  const buffer = await res.arrayBuffer()
  await Bun.write(filePath, new Uint8Array(buffer))

  const sizeMB = (buffer.byteLength / 1024 / 1024).toFixed(2)
  logger.info({ taskId, path: filePath, sizeMB }, '[Storage] Image saved')

  return getImageRelativePath(taskId)
}
