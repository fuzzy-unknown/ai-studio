import type { Task } from '../types'
import { useCallback, useState } from 'react'
import { getModelLabel, hasFormType, isImageTaskLike } from '../modelRegistry'

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

function isImageTask(task: Task): boolean {
  return isImageTaskLike(task)
}

function isImageEditModel(model: string | null): boolean {
  return hasFormType(model, 'i2i')
}

function isI2v(model: string | null): boolean {
  return hasFormType(model, 'i2v')
}

function isVideoEdit(model: string | null): boolean {
  return hasFormType(model, 'edit')
}

function isWan27I2v(model: string | null): boolean {
  return hasFormType(model, 'wan27-i2v')
}

interface TaskMediaInput {
  type?: string
  url: string
}

function getTaskMediaInputs(task: Task): TaskMediaInput[] {
  if (!task.inputImageUrl)
    return []
  const parsed = JSON.parse(task.inputImageUrl) as TaskMediaInput[]
  return parsed.filter(item => item.url)
}

function isAudioInput(input: TaskMediaInput): boolean {
  return input.type === 'driving_audio'
}

function isVideoInput(input: TaskMediaInput): boolean {
  return input.type === 'first_clip' || input.type === 'video'
}

function getVideoSrc(task: Task): string | null {
  if (task.localPath) {
    const paths = parseUrls(task.localPath)
    if (paths.length === 0)
      return null
    const filename = paths[0].split('/').pop()
    if (!filename)
      return null
    if (isImageTask(task))
      return `/api/image/files/${filename}`
    return `/api/video/files/${filename}`
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
      <span className="task-model-tag">{getModelLabel(task.model)}</span>
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
  const mediaInputs = getTaskMediaInputs(task).filter(input => !isAudioInput(input))
  const wan27 = isWan27I2v(task.model)
  const edit = isImageEditModel(task.model)
  const hasVideo = (isVideoEdit(task.model) && !!task.inputVideoUrl) || (wan27 && mediaInputs.some(input => isVideoInput(input)))
  const hasImages = mediaInputs.length > 0 && (wan27 ? mediaInputs.some(input => !isVideoInput(input)) : true)

  if (!hasVideo && !hasImages)
    return null

  const imgLabel = edit ? '输入图' : isI2v(task.model) ? '首帧' : '参考图'
  const imagesOnly = wan27 ? mediaInputs.filter(input => !isVideoInput(input)) : mediaInputs
  const videoInputs = wan27 ? mediaInputs.filter(input => isVideoInput(input)) : []

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
      {videoInputs.map(input => (
        <div key={input.url} className="task-media-item">
          <video
            src={input.url}
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
          <img src={imagesOnly[0].url} alt={imgLabel} />
          <span className="task-ref-label">{imagesOnly[0].type === 'last_frame' ? '尾帧' : imgLabel}</span>
        </div>
      )}
      {hasImages && (imagesOnly.length > 1 || hasVideo) && imagesOnly.map((input, i) => (
        <div key={input.url} className="task-media-item">
          <img src={input.url} alt={`${imgLabel} ${i + 1}`} />
          <span className="task-ref-label">
            {wan27 ? (input.type === 'last_frame' ? '尾帧' : '首帧') : `${imgLabel} ${i + 1}`}
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

function parseUrls(value: string | null): string[] {
  if (!value)
    return []
  return JSON.parse(value) as string[]
}

/** 将 localPath/videoUrl JSON 数组解析为文件服务 URL 列表 */
function resolveImageUrls(task: Task): string[] {
  // 优先 localPath → 转为文件服务 URL
  if (task.localPath) {
    const paths = parseUrls(task.localPath)
    if (paths.length > 0) {
      return paths
        .map(p => p.split('/').pop())
        .filter((filename): filename is string => !!filename)
        .map(filename => `/api/image/files/${filename}`)
    }
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

  const handleDownload = useCallback((url: string) => {
    const filename = url.split('?')[0].split('/').pop()
    const a = document.createElement('a')
    a.href = url
    a.download = filename || `${task.taskId}.png`
    a.target = '_blank'
    a.rel = 'noopener noreferrer'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }, [task.taskId])

  if (urls.length === 0)
    return null

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
          <div key={url} className="task-image-wrapper">
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
  const handleDelete = useCallback(async () => {
    try {
      await fetch(`/api/tasks/${task.taskId}`, { method: 'DELETE' })
      onRefresh?.()
    }
    catch {}
  }, [task.taskId, onRefresh])

  if (task.status === 'PENDING' || task.status === 'RUNNING')
    return <LoadingCard task={task} onRefresh={onRefresh} />

  const info = STATUS_MAP[task.status] || { label: task.status, className: '' }
  const isImage = isImageTask(task)
  const videoSrc = !isImage ? getVideoSrc(task) : null

  const isFailed = task.status === 'FAILED' || task.status === 'UNKNOWN'

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
