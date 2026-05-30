/**
 * 模型注册表 — 集中声明所有模型的元信息
 *
 * 核心设计：用数据查询替代散布各处的 if/else 判断。
 * 新增模型 = 在 MODELS 对象中新增一条声明，不需要改任何分支逻辑。
 */

export type TaskCategory = 'video' | 'image'
export type ApiMode = 'sync' | 'async'

export interface ModelDefinition {
  /** 模型 ID，如 'happyhorse-1.0-t2v' */
  id: string
  /** 大类：视频 / 图片 */
  category: TaskCategory
  /** 子类型标签，如 't2v', 'i2v', 'wan27-i2v', 't2i', 'i2i' */
  subType: string
  /** API 调用模式 */
  apiMode: ApiMode
  /** 中文标签 */
  label: string
  /**
   * 必填字段校验：返回错误消息字符串表示校验失败，undefined 表示通过
   * params 是原始请求 body
   */
  validate: (params: any) => string | undefined
  /** DB 写入时的默认值 */
  defaults: {
    resolution?: string
    ratio?: string | null // null = 不写入
    duration?: number | null
  }
  /**
   * 从请求参数计算存入 DB 的 inputImageUrl
   * 返回 string | null
   */
  resolveInputImageUrl: (params: any) => string | null
  /** 是否有 ratio 字段 */
  hasRatio: boolean
  /** 是否有 duration 字段 */
  hasDuration: boolean
  /** 是否有 inputVideoUrl 字段 */
  hasInputVideo: boolean
}

function hasOwn(params: any, key: string): boolean {
  return Object.hasOwn(params, key)
}

function rejectUnsupported(params: any, keys: string[], label: string): string | undefined {
  const key = keys.find(k => hasOwn(params, k))
  return key ? `${key} is not supported for ${label}` : undefined
}

function validateDuration(params: any, min: number, max: number, label: string): string | undefined {
  if (params.duration === undefined)
    return undefined
  if (!Number.isInteger(params.duration) || params.duration < min || params.duration > max)
    return `duration must be ${min}-${max} for ${label}`
}

function parseSize(size: string): { width: number, height: number } | undefined {
  const match = /^(\d+)\*(\d+)$/.exec(size)
  if (!match)
    return undefined
  return { width: Number(match[1]), height: Number(match[2]) }
}

function validateImageUrls(params: any, min: number, max: number, label: string): string | undefined {
  if (!params.imageUrls || params.imageUrls.length < min)
    return `imageUrls is required for ${label} (${min}-${max} images)`
  if (params.imageUrls.length > max)
    return `imageUrls must contain ${min}-${max} images`
}

function validateQwen2Size(size: string | undefined): string | undefined {
  if (!size)
    return undefined
  const parsed = parseSize(size)
  if (!parsed)
    return 'size must use WIDTH*HEIGHT format'
  const pixels = parsed.width * parsed.height
  if (pixels < 512 * 512 || pixels > 2048 * 2048)
    return 'size total pixels must be between 512*512 and 2048*2048 for qwen-image-2.0 models'
}

function validateLegacyImageSize(size: string | undefined): string | undefined {
  if (!size)
    return undefined
  const supported = new Set(['1664*928', '1472*1104', '1328*1328', '1104*1472', '928*1664'])
  if (!supported.has(size))
    return 'size must be one of the supported qwen-image-max/plus resolutions'
}

function validateEditImageSize(size: string | undefined): string | undefined {
  if (!size)
    return undefined
  const parsed = parseSize(size)
  if (!parsed)
    return 'size must use WIDTH*HEIGHT format'
  if (parsed.width < 512 || parsed.width > 2048 || parsed.height < 512 || parsed.height > 2048)
    return 'size width and height must be 512-2048 for qwen-image-edit-max/plus'
}

function validateImageCount(params: any, max: number, label: string): string | undefined {
  if (params.n === undefined)
    return undefined
  if (!Number.isInteger(params.n) || params.n < 1 || params.n > max)
    return `n must be 1-${max} for ${label}`
}

// ---- Video 模型 ----

const VIDEO_DEFAULTS = { resolution: '1080P', ratio: '16:9', duration: 5 }

const videoModels: Record<string, ModelDefinition> = {
  'happyhorse-1.0-t2v': {
    id: 'happyhorse-1.0-t2v',
    category: 'video',
    subType: 't2v',
    apiMode: 'async',
    label: '文生视频',
    validate: (params: any) =>
      rejectUnsupported(params, ['imageUrl', 'imageUrls', 'videoUrl', 'lastFrameUrl', 'drivingAudioUrl', 'firstClipUrl', 'negativePrompt', 'promptExtend', 'audioSetting'], 'happyhorse-1.0-t2v')
      ?? validateDuration(params, 3, 15, 'happyhorse-1.0-t2v'),
    defaults: { ...VIDEO_DEFAULTS, resolution: '720P' },
    resolveInputImageUrl: () => null,
    hasRatio: true,
    hasDuration: true,
    hasInputVideo: false,
  },
  'happyhorse-1.0-i2v': {
    id: 'happyhorse-1.0-i2v',
    category: 'video',
    subType: 'i2v',
    apiMode: 'async',
    label: '图生视频',
    validate: (params: any) => {
      const unsupported = rejectUnsupported(params, ['imageUrls', 'videoUrl', 'ratio', 'lastFrameUrl', 'drivingAudioUrl', 'firstClipUrl', 'negativePrompt', 'promptExtend', 'audioSetting'], 'happyhorse-1.0-i2v')
      if (unsupported)
        return unsupported
      const durationError = validateDuration(params, 3, 15, 'happyhorse-1.0-i2v')
      if (durationError)
        return durationError
      if (!params.imageUrl)
        return 'imageUrl is required for image-to-video model'
    },
    defaults: { ...VIDEO_DEFAULTS, ratio: null },
    resolveInputImageUrl: (params: any) =>
      params.imageUrl ? JSON.stringify([{ type: 'first_frame', url: params.imageUrl }]) : null,
    hasRatio: false,
    hasDuration: true,
    hasInputVideo: false,
  },
  'happyhorse-1.0-r2v': {
    id: 'happyhorse-1.0-r2v',
    category: 'video',
    subType: 'r2v',
    apiMode: 'async',
    label: '参考生视频',
    validate: (params: any) => {
      const unsupported = rejectUnsupported(params, ['imageUrl', 'videoUrl', 'lastFrameUrl', 'drivingAudioUrl', 'firstClipUrl', 'negativePrompt', 'promptExtend', 'audioSetting'], 'happyhorse-1.0-r2v')
      if (unsupported)
        return unsupported
      const durationError = validateDuration(params, 3, 15, 'happyhorse-1.0-r2v')
      if (durationError)
        return durationError
      if (!params.imageUrls || params.imageUrls.length === 0)
        return 'imageUrls is required for reference-to-video model'
      if (params.imageUrls.length < 1 || params.imageUrls.length > 9)
        return 'imageUrls must contain 1-9 images for reference-to-video model'
    },
    defaults: { ...VIDEO_DEFAULTS, ratio: null },
    resolveInputImageUrl: (params: any) =>
      params.imageUrls?.length > 0
        ? JSON.stringify(params.imageUrls.map((url: string) => ({ type: 'reference_image', url })))
        : null,
    hasRatio: true,
    hasDuration: true,
    hasInputVideo: false,
  },
  'happyhorse-1.0-video-edit': {
    id: 'happyhorse-1.0-video-edit',
    category: 'video',
    subType: 'edit',
    apiMode: 'async',
    label: '视频编辑',
    validate: (params: any) => {
      const unsupported = rejectUnsupported(params, ['imageUrl', 'ratio', 'duration', 'lastFrameUrl', 'drivingAudioUrl', 'firstClipUrl', 'negativePrompt', 'promptExtend'], 'happyhorse-1.0-video-edit')
      if (unsupported)
        return unsupported
      if (!params.videoUrl)
        return 'videoUrl is required for video-edit model'
      if (params.imageUrls && params.imageUrls.length > 5)
        return 'imageUrls must contain 0-5 images for video-edit model'
    },
    defaults: { resolution: '1080P', ratio: null, duration: null },
    resolveInputImageUrl: (params: any) =>
      params.imageUrls?.length > 0
        ? JSON.stringify(params.imageUrls.map((url: string) => ({ type: 'reference_image', url })))
        : null,
    hasRatio: false,
    hasDuration: false,
    hasInputVideo: true,
  },
  'wan2.7-i2v-2026-04-25': {
    id: 'wan2.7-i2v-2026-04-25',
    category: 'video',
    subType: 'wan27-i2v',
    apiMode: 'async',
    label: '万相2.7 图生视频',
    validate: (params: any) => {
      const unsupported = rejectUnsupported(params, ['imageUrls', 'videoUrl', 'ratio', 'audioSetting'], 'wan2.7-i2v')
      if (unsupported)
        return unsupported
      const durationError = validateDuration(params, 2, 15, 'wan2.7-i2v')
      if (durationError)
        return durationError
      const hasFirstFrame = !!params.imageUrl
      const hasLastFrame = !!params.lastFrameUrl
      const hasAudio = !!params.drivingAudioUrl
      const hasFirstClip = !!params.firstClipUrl
      if (!params.imageUrl && !params.firstClipUrl)
        return 'imageUrl or firstClipUrl is required for wan2.7-i2v model'
      if (hasFirstFrame && hasFirstClip)
        return 'first_frame and first_clip cannot be used together for wan2.7-i2v'
      if (hasFirstClip && hasAudio)
        return 'driving_audio is only supported with first_frame for wan2.7-i2v'
      if (hasLastFrame && !hasFirstFrame && !hasFirstClip)
        return 'lastFrameUrl requires imageUrl or firstClipUrl for wan2.7-i2v'
    },
    defaults: { ...VIDEO_DEFAULTS, ratio: null },
    resolveInputImageUrl: (params: any) => {
      const media = [
        params.imageUrl ? { type: 'first_frame', url: params.imageUrl } : null,
        params.lastFrameUrl ? { type: 'last_frame', url: params.lastFrameUrl } : null,
        params.drivingAudioUrl ? { type: 'driving_audio', url: params.drivingAudioUrl } : null,
        params.firstClipUrl ? { type: 'first_clip', url: params.firstClipUrl } : null,
      ].filter(Boolean)
      return media.length > 0 ? JSON.stringify(media) : null
    },
    hasRatio: false,
    hasDuration: true,
    hasInputVideo: false,
  },
}

// ---- Image 模型 ----

const SYNC_IMAGE_MODELS = new Set(['qwen-image-2.0-pro', 'qwen-image-2.0'])
const EDIT_IMAGE_MODELS = new Set(['qwen-image-edit-max', 'qwen-image-edit-plus', 'qwen-image-edit'])

const imageModels: Record<string, ModelDefinition> = {
  'qwen-image-2.0-pro': {
    id: 'qwen-image-2.0-pro',
    category: 'image',
    subType: 't2i',
    apiMode: 'sync',
    label: '文生图 Pro',
    validate: (params: any) =>
      (params.imageUrls ? validateImageUrls(params, 1, 3, 'qwen-image-2.0 edit') : undefined)
      ?? validateImageCount(params, 6, 'qwen-image-2.0 models')
      ?? validateQwen2Size(params.size),
    defaults: {},
    resolveInputImageUrl: () => null,
    hasRatio: false,
    hasDuration: false,
    hasInputVideo: false,
  },
  'qwen-image-2.0': {
    id: 'qwen-image-2.0',
    category: 'image',
    subType: 't2i',
    apiMode: 'sync',
    label: '文生图 2.0',
    validate: (params: any) =>
      (params.imageUrls ? validateImageUrls(params, 1, 3, 'qwen-image-2.0 edit') : undefined)
      ?? validateImageCount(params, 6, 'qwen-image-2.0 models')
      ?? validateQwen2Size(params.size),
    defaults: {},
    resolveInputImageUrl: () => null,
    hasRatio: false,
    hasDuration: false,
    hasInputVideo: false,
  },
  'qwen-image-max': {
    id: 'qwen-image-max',
    category: 'image',
    subType: 't2i',
    apiMode: 'async',
    label: '文生图 Max',
    validate: (params: any) =>
      rejectUnsupported(params, ['imageUrls'], 'qwen-image-max')
      ?? (params.prompt.length > 800 ? 'prompt max 800 chars for qwen-image-max' : undefined)
      ?? validateImageCount(params, 1, 'qwen-image-max')
      ?? validateLegacyImageSize(params.size),
    defaults: {},
    resolveInputImageUrl: () => null,
    hasRatio: false,
    hasDuration: false,
    hasInputVideo: false,
  },
  'qwen-image-plus': {
    id: 'qwen-image-plus',
    category: 'image',
    subType: 't2i',
    apiMode: 'async',
    label: '文生图 Plus',
    validate: (params: any) =>
      rejectUnsupported(params, ['imageUrls'], 'qwen-image-plus')
      ?? (params.prompt.length > 800 ? 'prompt max 800 chars for qwen-image-plus' : undefined)
      ?? validateImageCount(params, 1, 'qwen-image-plus')
      ?? validateLegacyImageSize(params.size),
    defaults: {},
    resolveInputImageUrl: () => null,
    hasRatio: false,
    hasDuration: false,
    hasInputVideo: false,
  },
  'qwen-image': {
    id: 'qwen-image',
    category: 'image',
    subType: 't2i',
    apiMode: 'async',
    label: '文生图',
    validate: (params: any) =>
      rejectUnsupported(params, ['imageUrls'], 'qwen-image')
      ?? (params.prompt.length > 800 ? 'prompt max 800 chars for qwen-image' : undefined)
      ?? validateImageCount(params, 1, 'qwen-image')
      ?? validateLegacyImageSize(params.size),
    defaults: {},
    resolveInputImageUrl: () => null,
    hasRatio: false,
    hasDuration: false,
    hasInputVideo: false,
  },
  'qwen-image-edit-max': {
    id: 'qwen-image-edit-max',
    category: 'image',
    subType: 'i2i',
    apiMode: 'sync',
    label: '图生图 Edit Max',
    validate: (params: any) => {
      if (params.prompt.length > 800)
        return 'prompt max 800 chars for qwen-image-edit-max'
      return validateImageUrls(params, 1, 3, 'image edit models')
        ?? validateImageCount(params, 6, 'qwen-image-edit-max')
        ?? validateEditImageSize(params.size)
    },
    defaults: {},
    resolveInputImageUrl: (params: any) =>
      params.imageUrls?.length > 0
        ? JSON.stringify(params.imageUrls.map((url: string) => ({ type: 'input_image', url })))
        : null,
    hasRatio: false,
    hasDuration: false,
    hasInputVideo: false,
  },
  'qwen-image-edit-plus': {
    id: 'qwen-image-edit-plus',
    category: 'image',
    subType: 'i2i',
    apiMode: 'sync',
    label: '图生图 Edit Plus',
    validate: (params: any) => {
      if (params.prompt.length > 800)
        return 'prompt max 800 chars for qwen-image-edit-plus'
      return validateImageUrls(params, 1, 3, 'image edit models')
        ?? validateImageCount(params, 6, 'qwen-image-edit-plus')
        ?? validateEditImageSize(params.size)
    },
    defaults: {},
    resolveInputImageUrl: (params: any) =>
      params.imageUrls?.length > 0
        ? JSON.stringify(params.imageUrls.map((url: string) => ({ type: 'input_image', url })))
        : null,
    hasRatio: false,
    hasDuration: false,
    hasInputVideo: false,
  },
  'qwen-image-edit': {
    id: 'qwen-image-edit',
    category: 'image',
    subType: 'i2i',
    apiMode: 'sync',
    label: '图生图 Edit',
    validate: (params: any) => {
      if (params.prompt.length > 800)
        return 'prompt max 800 chars for qwen-image-edit'
      return validateImageUrls(params, 1, 3, 'image edit models')
        ?? validateImageCount(params, 1, 'qwen-image-edit')
        ?? rejectUnsupported(params, ['size', 'promptExtend'], 'qwen-image-edit')
    },
    defaults: {},
    resolveInputImageUrl: (params: any) =>
      params.imageUrls?.length > 0
        ? JSON.stringify(params.imageUrls.map((url: string) => ({ type: 'input_image', url })))
        : null,
    hasRatio: false,
    hasDuration: false,
    hasInputVideo: false,
  },
}

// ---- 合并所有模型 ----

export const MODELS: Record<string, ModelDefinition> = {
  ...videoModels,
  ...imageModels,
}

// ---- 工具函数（替代散布各处的 is* 函数） ----

export function getModel(id: string): ModelDefinition | undefined {
  return MODELS[id]
}

export function getModelOrThrow(id: string): ModelDefinition {
  const def = MODELS[id]
  if (!def)
    throw new Error(`Unknown model: ${id}`)
  return def
}

export function isVideoModel(id: string): boolean {
  return MODELS[id]?.category === 'video'
}

export function isImageModel(id: string): boolean {
  return MODELS[id]?.category === 'image'
}

export function isSyncModel(id: string): boolean {
  return MODELS[id]?.apiMode === 'sync'
}

export function isAsyncModel(id: string): boolean {
  return MODELS[id]?.apiMode === 'async'
}

/** 判断是否为图像编辑模型 */
export function isEditModel(id: string): boolean {
  return MODELS[id]?.subType === 'i2i'
}

/** 判断是否为 qwen-image 系列模型（含带日期后缀的快照版本） */
export function isQwenImageModel(id: string): boolean {
  if (MODELS[id]?.category === 'image')
    return true
  // 兼容带日期后缀的快照版本
  if (id.startsWith('qwen-image-2.0-pro-') || id.startsWith('qwen-image-2.0-'))
    return true
  if (id.startsWith('qwen-image-edit-max-') || id.startsWith('qwen-image-edit-plus-'))
    return true
  return false
}

/** 判断是否为同步图片模型（含带日期后缀的快照版本） */
export function isSyncImageModel(id: string): boolean {
  if (SYNC_IMAGE_MODELS.has(id) || EDIT_IMAGE_MODELS.has(id))
    return true
  if (id.startsWith('qwen-image-2.0-pro-') || id.startsWith('qwen-image-2.0-'))
    return true
  if (id.startsWith('qwen-image-edit-max-') || id.startsWith('qwen-image-edit-plus-'))
    return true
  return false
}

/** 判断是否为图像编辑模型（含带日期后缀的快照版本） */
export function isImageEditModel(id: string): boolean {
  if (EDIT_IMAGE_MODELS.has(id))
    return true
  if (id.startsWith('qwen-image-edit-max-') || id.startsWith('qwen-image-edit-plus-'))
    return true
  return false
}

/** 中文标签查找 */
export function getModelLabel(id: string): string {
  return MODELS[id]?.label ?? id
}

/** 所有视频模型 ID */
export const VIDEO_MODEL_IDS = Object.values(videoModels).map(m => m.id)

/** 所有图片模型 ID */
export const IMAGE_MODEL_IDS = Object.values(imageModels).map(m => m.id)
