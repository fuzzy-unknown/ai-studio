import type { Task } from '../types'
import { useCallback, useState } from 'react'

interface Props {
  task: Task
  onRefresh?: () => void
  onRetry?: (task: Task) => void
}

const STATUS_MAP: Record<string, { label: string, className: string }> = {
  PENDING: { label: '排队中', className: 'status-pending' },
  RUNNING: { label: '生成中', className: 'status-running' },
  SUCCEEDED: { label: '已完成', className: 'status-succeeded' },
  FAILED: { label: '失败', className: 'status-failed' },
  UNKNOWN: { label: '未知', className: 'status-unknown' },
  CANCELED: { label: '已取消', className: 'status-canceled' },
}

const MODEL_LABELS: Record<string, string> = {
  'happyhorse-1.0-t2v': '文生视频',
  'happyhorse-1.0-i2v': '图生视频',
  'happyhorse-1.0-r2v': '参考生视频',
  'happyhorse-1.0-video-edit': '视频编辑',
  'wan2.7-i2v-2026-04-25': '万相2.7 图生视频',
  'qwen-image-2.0-pro': '文生图 Pro',
  'qwen-image-2.0': '文生图 2.0',
  'qwen-image-max': '文生图 Max',
  'qwen-image-plus': '文生图 Plus',
  'qwen-image-edit-max': '图生图 Edit Max',
  'qwen-image-edit-plus': '图生图 Edit Plus',
  'qwen-image-edit': '图生图 Edit',
}

function isImageTask(task: Task): boolean {
  return task.type === 'image' || !!task.model?.startsWith('qwen-image')
}

function isImageEditModel(model: string | null): boolean {
  return !!model?.startsWith('qwen-image-edit')
}

function isI2v(model: string | null): boolean {
  return model === 'happyhorse-1.0-i2v'
}

function isR2v(model: string | null): boolean {
  return model === 'happyhorse-1.0-r2v'
}

function isVideoEdit(model: string | null): boolean {
  return model === 'happyhorse-1.0-video-edit'
}

function isWan27I2v(model: string | null): boolean {
  return model === 'wan2.7-i2v-2026-04-25'
}

function getRefImages(task: Task): string[] {
  if (!task.inputImageUrl)
    return []
  try {
    const parsed = JSON.parse(task.inputImageUrl)
    if (Array.isArray(parsed)) {
      if (isWan27I2v(task.model))
        return parsed.filter((url: string) => !isAudioUrl(url))
      return parsed
    }
  }
  catch {}
  return [task.inputImageUrl]
}

function isAudioUrl(url: string): boolean {
  return url.startsWith('data:audio') || url.endsWith('.mp3') || url.endsWith('.wav')
}

function isVideoUrl(url: string): boolean {
  return url.startsWith('data:video') || url.endsWith('.mp4') || url.endsWith('.mov')
}

function getVideoSrc(task: Task): string | null {
  if (task.localPath) {
    const paths = parseUrls(task.localPath)
    if (paths.length === 0)
      return null
    if (isImageTask(task))
      return `/api/image/files/${paths[0].split('/').pop()}`
    return `/api/video/files/${paths[0].split('/').pop()}`
  }
  if (task.videoUrl) {
    const urls = parseUrls(task.videoUrl)
    return urls[0] || null
  }
  return null
}

function TaskMeta({ task }: Props) {
  const isImage = isImageTask(task)

  return (
    <div className="task-meta">
      <span className="task-model-tag">{MODEL_LABELS[task.model || ''] || task.model}</span>
      <span>{task.resolution || task.size}</span>
      {!isImage && task.ratio && <span>{task.ratio}</span>}
      {!isImage && task.duration && <span>{`${task.duration}s`}</span>}
      {isImage && task.n && task.n > 1 && <span>{`${task.n} 张`}</span>}
      {task.cost != null && (
        <span className="task-cost-tag">
          {task.cost.toFixed(2)}
          {' '}
          元
        </span>
      )}
    </div>
  )
}

/** Unified media display — shows input video + reference images together */
function TaskMedia({ task }: Props) {
  const refImages = getRefImages(task)
  const wan27 = isWan27I2v(task.model)
  const edit = isImageEditModel(task.model)
  const hasVideo = (isVideoEdit(task.model) && !!task.inputVideoUrl) || (wan27 && refImages.some(url => isVideoUrl(url)))
  const hasImages = refImages.length > 0 && (wan27 ? refImages.some(url => !isVideoUrl(url)) : true)

  if (!hasVideo && !hasImages)
    return null

  const imgLabel = edit ? '输入图' : isI2v(task.model) ? '首帧' : '参考图'
  const imagesOnly = wan27 ? refImages.filter(url => !isVideoUrl(url)) : refImages
  const videoUrls = wan27 ? refImages.filter(url => isVideoUrl(url)) : []

  return (
    <div className="task-media">
      {(isVideoEdit(task.model) && task.inputVideoUrl) && (
        <div className="task-media-item">
          <video
            src={task.inputVideoUrl ?? undefined}
            className="task-media-video"
            muted
            autoPlay
            loop
            playsInline
            preload="auto"
          />
          <span className="task-ref-label">输入视频</span>
        </div>
      )}
      {videoUrls.map((url, i) => (
        <div key={url.slice(0, 30) + i} className="task-media-item">
          <video
            src={url}
            className="task-media-video"
            muted
            autoPlay
            loop
            playsInline
            preload="auto"
          />
          <span className="task-ref-label">输入视频</span>
        </div>
      ))}
      {hasImages && imagesOnly.length === 1 && !hasVideo && (
        <div className="task-media-item">
          <img src={imagesOnly[0]} alt={imgLabel} />
          <span className="task-ref-label">{imgLabel}</span>
        </div>
      )}
      {hasImages && (imagesOnly.length > 1 || hasVideo) && imagesOnly.map((url, i) => (
        <div key={url.slice(0, 30) + i} className="task-media-item">
          <img src={url} alt={`${imgLabel} ${i + 1}`} />
          <span className="task-ref-label">
            {wan27 ? (i === 0 ? '首帧' : '尾帧') : `${imgLabel} ${i + 1}`}
          </span>
        </div>
      ))}
    </div>
  )
}

function LoadingCard({ task, onRefresh }: Props) {
  const info = STATUS_MAP[task.status] || { label: task.status, className: '' }
  const isImage = isImageTask(task)
  const loadingText = task.status === 'RUNNING'
    ? (isImage ? '图片生成中...' : '视频生成中...')
    : '排队等待中...'

  const handleCancel = useCallback(async () => {
    try {
      await fetch(`/api/tasks/${task.taskId}/cancel`, { method: 'POST' })
      onRefresh?.()
    }
    catch {}
  }, [task.taskId, onRefresh])

  return (
    <div className="task-card task-card--loading">
      <div className="task-header">
        <span className={`task-status ${info.className}`}>{info.label}</span>
        <span className="task-time">{task.createdAt}</span>
      </div>
      <p className="task-prompt">{task.prompt}</p>
      <TaskMedia task={task} />
      <TaskMeta task={task} />
      <div className="loading-video">
        <div className="loading-shimmer" />
        <div className="loading-bar">
          <div className={`loading-bar-fill ${task.status === 'RUNNING' ? 'running' : ''}`} />
        </div>
        <span className="loading-text">{loadingText}</span>
      </div>
      <div className="task-actions">
        <button type="button" className="task-action-btn task-cancel-btn" onClick={handleCancel}>
          取消任务
        </button>
      </div>
    </div>
  )
}

/** 解析可能为 JSON 数组的 videoUrl/localPath */
function parseUrls(value: string | null): string[] {
  if (!value)
    return []
  try {
    const parsed = JSON.parse(value)
    if (Array.isArray(parsed))
      return parsed
  }
  catch {}
  return [value]
}

/** 将 localPath/videoUrl JSON 数组解析为文件服务 URL 列表 */
function resolveImageUrls(task: Task): string[] {
  // 优先 localPath → 转为文件服务 URL
  if (task.localPath) {
    const paths = parseUrls(task.localPath)
    if (paths.length > 0)
      return paths.map(p => `/api/image/files/${p.split('/').pop()}`)
  }
  // 降级到 videoUrl（远程 URL）
  if (task.videoUrl)
    return parseUrls(task.videoUrl)
  return []
}

/** 图片结果展示 + lightbox */
function ImageResult({ task }: Props) {
  const urls = resolveImageUrls(task)
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)

  if (urls.length === 0)
    return null

  const handleDownload = useCallback((url: string) => {
    const a = document.createElement('a')
    a.href = url
    a.download = `${task.taskId}.png`
    a.target = '_blank'
    a.rel = 'noopener noreferrer'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }, [task.taskId])

  if (urls.length <= 1) {
    return (
      <>
        <div className="task-image-wrapper">
          <img
            className="task-image"
            src={urls[0]}
            alt={task.prompt}
            onClick={() => setLightboxUrl(urls[0])}
          />
          <button type="button" className="task-image-download" onClick={() => handleDownload(urls[0])} title="下载图片">
            ⬇
          </button>
        </div>
        {lightboxUrl && (
          <div className="lightbox-overlay" onClick={() => setLightboxUrl(null)}>
            <img className="lightbox-image" src={lightboxUrl} alt={task.prompt} />
          </div>
        )}
      </>
    )
  }

  return (
    <>
      <div className="task-image-grid">
        {urls.map((url, i) => (
          <div key={url.slice(0, 30) + i} className="task-image-wrapper">
            <img
              className="task-image"
              src={url}
              alt={`${task.prompt} - ${i + 1}`}
              onClick={() => setLightboxUrl(url)}
            />
            <button type="button" className="task-image-download" onClick={() => handleDownload(url)} title="下载图片">
              ⬇
            </button>
          </div>
        ))}
      </div>
      {lightboxUrl && (
        <div className="lightbox-overlay" onClick={() => setLightboxUrl(null)}>
          <img className="lightbox-image" src={lightboxUrl} alt={task.prompt} />
        </div>
      )}
    </>
  )
}

export function TaskCard({ task, onRefresh, onRetry }: Props) {
  if (task.status === 'PENDING' || task.status === 'RUNNING')
    return <LoadingCard task={task} onRefresh={onRefresh} />

  const info = STATUS_MAP[task.status] || { label: task.status, className: '' }
  const isImage = isImageTask(task)
  const videoSrc = !isImage ? getVideoSrc(task) : null

  const isFailed = task.status === 'FAILED' || task.status === 'UNKNOWN'

  const handleDelete = useCallback(async () => {
    try {
      await fetch(`/api/tasks/${task.taskId}`, { method: 'DELETE' })
      onRefresh?.()
    }
    catch {}
  }, [task.taskId, onRefresh])

  return (
    <div className="task-card">
      <div className="task-header">
        <span className={`task-status ${info.className}`}>{info.label}</span>
        <span className="task-time">{task.createdAt}</span>
      </div>
      <p className="task-prompt">{task.prompt}</p>
      <TaskMedia task={task} />
      <TaskMeta task={task} />
      {isImage && <ImageResult task={task} />}
      {!isImage && videoSrc && (
        <div className="task-video-wrapper">
          <video
            className="task-video"
            src={videoSrc}
            controls
            preload="metadata"
          />
        </div>
      )}
      {task.errorMessage && (
        <p className="task-error">{task.errorMessage}</p>
      )}
      {(isFailed || task.status === 'CANCELED') && (
        <div className="task-actions">
          {isFailed && (
            <button type="button" className="task-action-btn task-retry-btn" onClick={() => onRetry?.(task)}>
              重试
            </button>
          )}
          <button type="button" className="task-action-btn task-delete-btn" onClick={handleDelete}>
            删除记录
          </button>
        </div>
      )}
    </div>
  )
}
