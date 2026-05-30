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

export function getImagePath(taskId: string, ext = '.png'): string {
  return join(IMAGE_DIR, `${taskId}${ext}`)
}

export function getImageRelativePath(taskId: string, ext = '.png'): string {
  return `storage/images/${taskId}${ext}`
}

/** 从 URL 路径或 Content-Type 推断图片扩展名 */
function inferImageExt(url: string, contentType?: string): string {
  // 优先从 URL 路径推断
  const pathname = url.split('?')[0].toLowerCase()
  if (pathname.endsWith('.jpg') || pathname.endsWith('.jpeg'))
    return '.jpg'
  if (pathname.endsWith('.webp'))
    return '.webp'
  if (pathname.endsWith('.png'))
    return '.png'
  // 降级到 Content-Type
  if (contentType) {
    if (contentType.includes('image/jpeg'))
      return '.jpg'
    if (contentType.includes('image/webp'))
      return '.webp'
  }
  // 默认 png
  return '.png'
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

  logger.info({ taskId, url: url.slice(0, 80) }, '[Storage] Downloading image')

  const res = await fetch(url)
  if (!res.ok)
    throw new Error(`Failed to download image: ${res.status} ${res.statusText}`)

  const ext = inferImageExt(url, res.headers.get('content-type') ?? undefined)
  const filePath = getImagePath(taskId, ext)

  const buffer = await res.arrayBuffer()
  await Bun.write(filePath, new Uint8Array(buffer))

  const sizeMB = (buffer.byteLength / 1024 / 1024).toFixed(2)
  logger.info({ taskId, path: filePath, sizeMB, ext }, '[Storage] Image saved')

  return getImageRelativePath(taskId, ext)
}
