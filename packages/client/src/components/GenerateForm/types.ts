/** 提交给 App 的数据结构（与原 Props.onSubmit 参数完全一致，保持向后兼容） */
export interface GenerateFormData {
  prompt: string
  model: string
  imageUrl?: string
  imageUrls?: string[]
  videoUrl?: string
  resolution: string
  ratio?: string
  duration?: number
  watermark?: boolean
  audioSetting?: string
  seed?: number
  // 图片模型专属
  size?: string
  negativePrompt?: string
  n?: number
  promptExtend?: boolean
  // 万相2.7 图生视频专属
  lastFrameUrl?: string
  drivingAudioUrl?: string
  firstClipUrl?: string
}

/** 每个模型表单的 props */
export interface ModelFormProps {
  model: string
  loading: boolean
  onSubmit: (data: GenerateFormData) => void
  /** 重试时回填的初始数据 */
  initialData?: Partial<GenerateFormData> | null
}
