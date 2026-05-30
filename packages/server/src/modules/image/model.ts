import { t } from 'elysia'

export const ImageGenerateBody = t.Object({
  prompt: t.String({ description: '生成提示词，1-1300 个字符', minLength: 1, maxLength: 1300, errorMessage: 'prompt is required (1-1300 chars)' }),
  model: t.Optional(t.String({ description: '模型 ID，如 qwen-image-2.0-pro、qwen-image-edit 等。默认 qwen-image-2.0-pro' })),
  size: t.Optional(t.String({ description: '图片尺寸，格式为 "宽*高"，如 "2048*2048"、"1024*1024"', errorMessage: 'size must be a string like 2048*2048' })),
  negativePrompt: t.Optional(t.String({ description: '反向提示词，排除不想要的元素，最长 500 字符', maxLength: 500, errorMessage: 'negativePrompt max 500 chars' })),
  n: t.Optional(t.Integer({ description: '生成图片数量，范围 1-6', minimum: 1, maximum: 6, error: 'n must be 1-6' })),
  promptExtend: t.Optional(t.Boolean({ description: '是否启用提示词扩展（AI 自动丰富提示词）' })),
  watermark: t.Optional(t.Boolean({ description: '是否添加水印' })),
  seed: t.Optional(t.Integer({ description: '随机种子，用于结果可复现，范围 0-2147483647', minimum: 0, maximum: 2147483647, error: 'seed must be 0-2147483647' })),
  // 图像编辑：输入图片 URL
  imageUrls: t.Optional(t.Array(t.String({ description: '输入图片 URL 数组（图生图/编辑模式，1-3 张）' }))),
})

export const ImageGenerateResponse = t.Object({
  task_id: t.String({ description: '任务 ID，同步模型返回 sync- 前缀，异步模型返回 DashScope 任务 ID' }),
  status: t.String({ description: '初始状态，同步模型为 SUCCEEDED，异步模型为 PENDING' }),
})

export const ImageTaskResponse = t.Object({
  id: t.Number({ description: '数据库自增 ID' }),
  taskId: t.String({ description: '任务唯一标识' }),
  model: t.Nullable(t.String({ description: '模型 ID，如 qwen-image-2.0-pro' })),
  prompt: t.String({ description: '生成提示词' }),
  status: t.String({ description: '任务状态：PENDING | RUNNING | SUCCEEDED | FAILED | CANCELED | UNKNOWN' }),
  resolution: t.Nullable(t.String({ description: '输出分辨率' })),
  ratio: t.Nullable(t.String({ description: '画面宽高比' })),
  duration: t.Nullable(t.Number({ description: '处理时长（秒）' })),
  inputVideoUrl: t.Nullable(t.String({ description: '输入视频 URL' })),
  inputImageUrl: t.Nullable(t.String({ description: '输入图片 URL（JSON 格式）' })),
  size: t.Nullable(t.String({ description: '图片尺寸，如 2048*2048' })),
  negativePrompt: t.Nullable(t.String({ description: '反向提示词' })),
  n: t.Nullable(t.Number({ description: '生成图片数量' })),
  promptExtend: t.Nullable(t.Number({ description: '是否启用提示词扩展（1=启用）' })),
  usage: t.Nullable(t.String({ description: '用量信息（JSON 格式）' })),
  cost: t.Nullable(t.Number({ description: '任务费用（元）' })),
  videoUrl: t.Nullable(t.String({ description: '结果图片 URL（可能是 JSON 数组，多图时包含多个 URL）' })),
  localPath: t.Nullable(t.String({ description: '本地存储路径（可能是 JSON 数组）' })),
  errorMessage: t.Nullable(t.String({ description: '错误信息（仅 FAILED 状态）' })),
  createdAt: t.Nullable(t.String({ description: '创建时间（ISO 8601）' })),
  updatedAt: t.Nullable(t.String({ description: '更新时间（ISO 8601）' })),
})

export const ImageTaskListResponse = t.Array(ImageTaskResponse)

export const ImageUsageStatsResponse = t.Object({
  totalDuration: t.Number({ description: '所有任务的总时长（秒）' }),
  totalCost: t.Number({ description: '所有任务的总费用（元）' }),
  taskCount: t.Number({ description: '任务总数' }),
})
