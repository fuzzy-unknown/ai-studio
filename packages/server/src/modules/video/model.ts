import { t } from 'elysia'

export const GenerateBody = t.Object({
  prompt: t.String({ description: '生成提示词，1-5000 个字符', minLength: 1, maxLength: 5000, errorMessage: 'prompt is required (1-5000 chars)' }),
  model: t.Optional(t.String({ description: '模型 ID，如 happyhorse-1.0-t2v、wan2.7-i2v-2026-04-25 等。默认 happyhorse-1.0-t2v' })),
  imageUrl: t.Optional(t.String({ description: '输入图片 URL（图生视频模式）', errorMessage: 'imageUrl must be a string' })),
  imageUrls: t.Optional(t.Array(t.String({ description: '参考图片 URL 数组（参考生视频模式，1-9 张）' }))),
  videoUrl: t.Optional(t.String({ description: '输入视频 URL（视频编辑模式）', errorMessage: 'videoUrl must be a string' })),
  resolution: t.Optional(t.Union([t.Literal('720P'), t.Literal('1080P')], { description: '输出分辨率，仅部分模型支持', error: 'resolution must be 720P or 1080P' })),
  ratio: t.Optional(t.Union([
    t.Literal('16:9'),
    t.Literal('9:16'),
    t.Literal('1:1'),
    t.Literal('4:3'),
    t.Literal('3:4'),
    t.Literal('4:5'),
    t.Literal('5:4'),
    t.Literal('9:21'),
    t.Literal('21:9'),
  ], { description: '画面宽高比', error: 'invalid ratio' })),
  duration: t.Optional(t.Integer({ description: '视频时长（秒），范围 2-15', minimum: 2, maximum: 15, error: 'duration must be 2-15' })),
  watermark: t.Optional(t.Boolean({ description: '是否添加水印' })),
  audioSetting: t.Optional(t.Union([t.Literal('auto'), t.Literal('origin')], { description: '音频设置：auto（自动生成）或 origin（保留原声）', error: 'audioSetting must be auto or origin' })),
  seed: t.Optional(t.Integer({ description: '随机种子，用于结果可复现，范围 0-2147483647', minimum: 0, maximum: 2147483647, error: 'seed must be 0-2147483647' })),
  // 万相2.7 图生视频专属参数
  lastFrameUrl: t.Optional(t.String({ description: '尾帧图片 URL（万相2.7 first_last_frame 模式）' })),
  drivingAudioUrl: t.Optional(t.String({ description: '驱动音频 URL（万相2.7 口型同步）' })),
  firstClipUrl: t.Optional(t.String({ description: '首段视频 URL（万相2.7 video_continuation 续写模式）' })),
  negativePrompt: t.Optional(t.String({ description: '反向提示词，排除不想要的元素，最长 500 字符', maxLength: 500 })),
  promptExtend: t.Optional(t.Boolean({ description: '是否启用提示词扩展（AI 自动丰富提示词）' })),
})

export const GenerateResponse = t.Object({
  task_id: t.String({ description: '任务 ID，用于后续查询任务状态和结果' }),
  status: t.String({ description: '初始状态，通常为 PENDING' }),
})

export const TaskResponse = t.Object({
  id: t.Number({ description: '数据库自增 ID' }),
  taskId: t.String({ description: '任务唯一标识' }),
  model: t.Nullable(t.String({ description: '模型 ID，如 happyhorse-1.0-t2v' })),
  prompt: t.String({ description: '生成提示词' }),
  status: t.String({ description: '任务状态：PENDING | RUNNING | SUCCEEDED | FAILED | CANCELED | UNKNOWN' }),
  resolution: t.Nullable(t.String({ description: '输出分辨率，如 720P、1080P' })),
  ratio: t.Nullable(t.String({ description: '画面宽高比，如 16:9' })),
  duration: t.Nullable(t.Number({ description: '视频时长（秒）' })),
  inputVideoUrl: t.Nullable(t.String({ description: '输入视频 URL' })),
  inputImageUrl: t.Nullable(t.String({ description: '输入图片 URL（JSON 格式）' })),
  usage: t.Nullable(t.String({ description: '用量信息（JSON 格式）' })),
  cost: t.Nullable(t.Number({ description: '任务费用（元）' })),
  videoUrl: t.Nullable(t.String({ description: '结果视频/图片 URL（可能是 JSON 数组）' })),
  localPath: t.Nullable(t.String({ description: '本地存储路径（可能是 JSON 数组）' })),
  errorMessage: t.Nullable(t.String({ description: '错误信息（仅 FAILED 状态）' })),
  createdAt: t.Nullable(t.String({ description: '创建时间（ISO 8601）' })),
  updatedAt: t.Nullable(t.String({ description: '更新时间（ISO 8601）' })),
  // 图片模型字段
  size: t.Nullable(t.String({ description: '图片尺寸，如 2048*2048（图片模型专用）' })),
  negativePrompt: t.Nullable(t.String({ description: '反向提示词' })),
  n: t.Nullable(t.Number({ description: '生成图片数量（图片模型专用）' })),
  promptExtend: t.Nullable(t.Number({ description: '是否启用提示词扩展（1=启用）' })),
})

export const TaskListResponse = t.Array(TaskResponse)

export const UsageStatsResponse = t.Object({
  totalDuration: t.Number({ description: '所有任务的总时长（秒）' }),
  totalCost: t.Number({ description: '所有任务的总费用（元）' }),
  taskCount: t.Number({ description: '任务总数' }),
})
