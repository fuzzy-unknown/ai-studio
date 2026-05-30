export interface UsageData {
  duration: number
  input_video_duration: number
  output_video_duration: number
  video_count: number
  SR: number
}

export interface Task {
  id?: number
  taskId: string
  type?: string | null
  model: string | null
  prompt: string
  status: string
  resolution: string | null
  ratio: string | null
  duration: number | null
  inputVideoUrl: string | null
  inputImageUrl: string | null
  usage: string | null
  cost: number | null
  videoUrl: string | null
  localPath: string | null
  errorMessage: string | null
  createdAt: string | null
  updatedAt: string | null
  // 图片模型专属
  size?: string | null
  negativePrompt?: string | null
  n?: number | null
  promptExtend?: number | null
}

export interface UsageStats {
  totalDuration: number
  totalCost: number
  taskCount: number
}
