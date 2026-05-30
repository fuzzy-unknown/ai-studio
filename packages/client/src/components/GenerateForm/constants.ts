export type Category = 'video' | 'image'

export const CATEGORIES = [
  { value: 'video' as const, label: '视频生成' },
  { value: 'image' as const, label: '图片生成' },
]

/**
 * 三级模型结构：
 * Category → SubType → Model[]
 *
 * 一级：视频生成 / 图片生成（Tab）
 * 二级：文生视频 / 图生视频 / ... （Tab）
 * 三级：具体模型 ID（下拉，仅多项时显示）
 */
export interface ModelSubType {
  type: string
  label: string
  models: { value: string, label: string }[]
}

export const MODEL_GROUPS: Record<Category, ModelSubType[]> = {
  video: [
    {
      type: 't2v',
      label: '文生视频',
      models: [
        { value: 'happyhorse-1.0-t2v', label: 'happyhorse-1.0-t2v' },
      ],
    },
    {
      type: 'i2v',
      label: '图生视频',
      models: [
        { value: 'happyhorse-1.0-i2v', label: 'happyhorse-1.0-i2v' },
      ],
    },
    {
      type: 'r2v',
      label: '参考生视频',
      models: [
        { value: 'happyhorse-1.0-r2v', label: 'happyhorse-1.0-r2v' },
      ],
    },
    {
      type: 'edit',
      label: '视频编辑',
      models: [
        { value: 'happyhorse-1.0-video-edit', label: 'happyhorse-1.0-video-edit' },
      ],
    },
  ],
  image: [
    {
      type: 't2i',
      label: '文生图',
      models: [
        { value: 'qwen-image-2.0-pro', label: 'Qwen-Image 2.0 Pro（推荐）' },
        { value: 'qwen-image-2.0', label: 'Qwen-Image 2.0（加速版）' },
        { value: 'qwen-image-max', label: 'Qwen-Image Max' },
        { value: 'qwen-image-plus', label: 'Qwen-Image Plus' },
      ],
    },
    // 后续可在此添加「图生图」等子类型
  ],
}

export type ModelType = 't2v' | 'i2v' | 'r2v' | 'edit' | 't2i'

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
