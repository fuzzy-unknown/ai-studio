import { t } from 'elysia'

export const GenerateBody = t.Object({
  prompt: t.String({ minLength: 1, maxLength: 5000, errorMessage: 'prompt is required (1-5000 chars)' }),
  model: t.Optional(t.String()),
  imageUrl: t.Optional(t.String({ errorMessage: 'imageUrl must be a string' })),
  imageUrls: t.Optional(t.Array(t.String())),
  videoUrl: t.Optional(t.String({ errorMessage: 'videoUrl must be a string' })),
  resolution: t.Optional(t.Union([t.Literal('720P'), t.Literal('1080P')], { error: 'resolution must be 720P or 1080P' })),
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
  ], { error: 'invalid ratio' })),
  duration: t.Optional(t.Integer({ minimum: 3, maximum: 15, error: 'duration must be 3-15' })),
  watermark: t.Optional(t.Boolean()),
  audioSetting: t.Optional(t.Union([t.Literal('auto'), t.Literal('origin')], { error: 'audioSetting must be auto or origin' })),
  seed: t.Optional(t.Integer({ minimum: 0, maximum: 2147483647, error: 'seed must be 0-2147483647' })),
})

export const GenerateResponse = t.Object({
  task_id: t.String(),
  status: t.String(),
})

export const TaskResponse = t.Object({
  id: t.Number(),
  taskId: t.String(),
  model: t.Nullable(t.String()),
  prompt: t.String(),
  status: t.String(),
  resolution: t.Nullable(t.String()),
  ratio: t.Nullable(t.String()),
  duration: t.Nullable(t.Number()),
  inputVideoUrl: t.Nullable(t.String()),
  inputImageUrl: t.Nullable(t.String()),
  usage: t.Nullable(t.String()),
  cost: t.Nullable(t.Number()),
  videoUrl: t.Nullable(t.String()),
  localPath: t.Nullable(t.String()),
  errorMessage: t.Nullable(t.String()),
  createdAt: t.Nullable(t.String()),
  updatedAt: t.Nullable(t.String()),
  // 图片模型字段
  size: t.Nullable(t.String()),
  negativePrompt: t.Nullable(t.String()),
  n: t.Nullable(t.Number()),
  promptExtend: t.Nullable(t.Number()),
})

export const TaskListResponse = t.Array(TaskResponse)

export const UsageStatsResponse = t.Object({
  totalDuration: t.Number(),
  totalCost: t.Number(),
  taskCount: t.Number(),
})
