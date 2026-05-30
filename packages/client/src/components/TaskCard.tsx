import type { Task } from '../types'

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
  'wan2.7-i2v-2026-04-25': '万相2.7 图生视频',
  'qwen-image-2.0-pro': '文生图 Pro',
  'qwen-image-2.0': '文生图 2.0',
  'qwen-image-max': '文生图 Max',
  'qwen-image-plus': '文生图 Plus',
  'qwen-image-edit-max': '图生图 Edit Max',
  'qwen-image-edit-plus': '图生图 Edit Plus',
  'qwen-image-edit': '图生图 Edit',
}

function isImageModel(model: string | null): boolean {
  return !!model?.startsWith('qwen-image')
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
  // 统一尝试 JSON 解析：多图场景存为 JSON 数组
  try {
    const parsed = JSON.parse(task.inputImageUrl)
    if (Array.isArray(parsed)) {
      // wan2.7 过滤掉音频 URL
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

function getVideoSrc(task: Task): string | null {
  if (task.localPath) {
    // 图片模型用 image 端点，视频模型用 video 端点
    if (isImageModel(task.model))
      return `/api/image/files/${task.taskId}.png`
    return `/api/video/files/${task.taskId}.mp4`
  }
  if (task.videoUrl)
    return task.videoUrl
  return null
}

function TaskMeta({ task }: Props) {
  const isImage = isImageModel(task.model)

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

function isVideoUrl(url: string): boolean {
  return url.startsWith('data:video') || url.endsWith('.mp4') || url.endsWith('.mov')
}

function LoadingCard({ task }: Props) {
  const info = STATUS_MAP[task.status] || { label: task.status, className: '' }
  const isImage = isImageModel(task.model)
  const loadingText = task.status === 'RUNNING'
    ? (isImage ? '图片生成中...' : '视频生成中...')
    : '排队等待中...'

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

/** 图片结果展示 */
function ImageResult({ task }: Props) {
  const src = getVideoSrc(task)
  if (!src)
    return null

  // 多图场景：videoUrl 是 JSON 数组
  const urls = parseUrls(src)

  if (urls.length <= 1) {
    return (
      <div className="task-image-wrapper">
        <img
          className="task-image"
          src={urls[0] || src}
          alt={task.prompt}
        />
      </div>
    )
  }

  return (
    <div className="task-image-grid">
      {urls.map((url, i) => (
        <div key={url.slice(0, 30) + i} className="task-image-wrapper">
          <img
            className="task-image"
            src={url}
            alt={`${task.prompt} - ${i + 1}`}
          />
        </div>
      ))}
    </div>
  )
}

export function TaskCard({ task }: Props) {
  if (task.status === 'PENDING' || task.status === 'RUNNING')
    return <LoadingCard task={task} />

  const info = STATUS_MAP[task.status] || { label: task.status, className: '' }
  const isImage = isImageModel(task.model)
  const videoSrc = !isImage ? getVideoSrc(task) : null

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
    </div>
  )
}
