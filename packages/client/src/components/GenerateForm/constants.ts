export const MODELS = [
  { value: 'happyhorse-1.0-t2v', label: 'HappyHorse 文生视频', type: 't2v' as const },
  { value: 'happyhorse-1.0-i2v', label: 'HappyHorse 图生视频（首帧）', type: 'i2v' as const },
  { value: 'happyhorse-1.0-r2v', label: 'HappyHorse 参考生视频', type: 'r2v' as const },
  { value: 'happyhorse-1.0-video-edit', label: 'HappyHorse 视频编辑', type: 'edit' as const },
  { value: 'qwen-image-2.0-pro', label: 'Qwen-Image 2.0 Pro（推荐）', type: 't2i' as const },
  { value: 'qwen-image-2.0', label: 'Qwen-Image 2.0（加速版）', type: 't2i' as const },
  { value: 'qwen-image-max', label: 'Qwen-Image Max', type: 't2i' as const },
  { value: 'qwen-image-plus', label: 'Qwen-Image Plus', type: 't2i' as const },
]

export type ModelType = 't2v' | 'i2v' | 'r2v' | 'edit' | 't2i'

export const IMAGE_MODELS = [
  { value: 'qwen-image-2.0-pro', label: '2.0 Pro（推荐）' },
  { value: 'qwen-image-2.0', label: '2.0（加速版）' },
  { value: 'qwen-image-max', label: 'Max' },
  { value: 'qwen-image-plus', label: 'Plus' },
]

/** 2.0 系列支持的分辨率 */
export const IMAGE_SIZES_V2 = [
  { value: '2048*2048', label: '2048×2048（1:1）' },
  { value: '2688*1536', label: '2688×1536（16:9）' },
  { value: '1536*2688', label: '1536×2688（9:16）' },
  { value: '2368*1728', label: '2368×1728（4:3）' },
  { value: '1728*2368', label: '1728×2368（3:4）' },
]

/** Max/Plus 系列支持的分辨率 */
export const IMAGE_SIZES_LEGACY = [
  { value: '1664*928', label: '1664×928（16:9）' },
  { value: '1472*1104', label: '1472×1104（4:3）' },
  { value: '1328*1328', label: '1328×1328（1:1）' },
  { value: '1104*1472', label: '1104×1472（3:4）' },
  { value: '928*1664', label: '928×1664（9:16）' },
]

export const RATIOS = ['16:9', '9:16', '1:1', '4:3', '3:4', '4:5', '5:4', '9:21', '21:9'] as const
export const RESOLUTIONS = ['720P', '1080P'] as const
export const DURATIONS = [3, 5, 8, 10, 15] as const
export const EDIT_MAX_IMAGES = 5
export const R2V_MAX_IMAGES = 9
