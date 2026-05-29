import type { Task, UsageData } from '../types'

interface Props {
  task: Task
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

function getRefImages(task: Task): string[] {
  if (!task.inputImageUrl)
    return []
  if (isR2v(task.model) || isVideoEdit(task.model)) {
    try {
      const parsed = JSON.parse(task.inputImageUrl)
      if (Array.isArray(parsed))
        return parsed
    }
    catch {}
  }
  return [task.inputImageUrl]
}

function getVideoSrc(task: Props['task']): string | null {
  if (task.localPath)
    return `/api/video/files/${task.taskId}.mp4`
  if (task.videoUrl)
    return task.videoUrl
  return null
}

const PRICE_PER_SECOND: Record<number, number> = { 720: 0.04, 1080: 0.08 }

function getUsageCost(task: Task): { duration: number, cost: number } | null {
  if (!task.usage)
    return null
  try {
    const u = JSON.parse(task.usage) as UsageData
    const price = PRICE_PER_SECOND[u.SR] || 0
    return { duration: u.duration, cost: Number((u.duration * price).toFixed(2)) }
  }
  catch {
    return null
  }
}

function TaskMeta({ task }: Props) {
  const costInfo = getUsageCost(task)
  return (
    <div className="task-meta">
      <span className="task-model-tag">{MODEL_LABELS[task.model || 'happyhorse-1.0-t2v'] || task.model}</span>
      <span>{task.resolution}</span>
      {task.ratio && <span>{task.ratio}</span>}
      {task.duration && <span>{`${task.duration}s`}</span>}
      {costInfo && (
        <span className="task-cost-tag">
          {costInfo.cost}
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
  const hasVideo = isVideoEdit(task.model) && !!task.inputVideoUrl
  const hasImages = refImages.length > 0

  if (!hasVideo && !hasImages)
    return null

  const imgLabel = isI2v(task.model) ? '首帧' : '参考图'

  return (
    <div className="task-media">
      {hasVideo && (
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
      {hasImages && refImages.length === 1 && !hasVideo && (
        <div className="task-media-item">
          <img src={refImages[0]} alt={imgLabel} />
          <span className="task-ref-label">{imgLabel}</span>
        </div>
      )}
      {hasImages && (refImages.length > 1 || hasVideo) && refImages.map((url, i) => (
        <div key={url.slice(0, 30) + i} className="task-media-item">
          <img src={url} alt={`参考图 ${i + 1}`} />
          <span className="task-ref-label">
            {imgLabel}
            {' '}
            {i + 1}
          </span>
        </div>
      ))}
    </div>
  )
}

function LoadingCard({ task }: Props) {
  const info = STATUS_MAP[task.status] || { label: task.status, className: '' }

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
        <span className="loading-text">{task.status === 'RUNNING' ? '视频生成中...' : '排队等待中...'}</span>
      </div>
    </div>
  )
}

export function TaskCard({ task }: Props) {
  if (task.status === 'PENDING' || task.status === 'RUNNING')
    return <LoadingCard task={task} />

  const info = STATUS_MAP[task.status] || { label: task.status, className: '' }
  const videoSrc = getVideoSrc(task)

  return (
    <div className="task-card">
      <div className="task-header">
        <span className={`task-status ${info.className}`}>{info.label}</span>
        <span className="task-time">{task.createdAt}</span>
      </div>
      <p className="task-prompt">{task.prompt}</p>
      <TaskMedia task={task} />
      <TaskMeta task={task} />
      {videoSrc && (
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
    </div>
  )
}
