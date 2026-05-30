import { t } from 'elysia'

export const ImageGenerateBody = t.Object({
  prompt: t.String({ minLength: 1, maxLength: 1300, errorMessage: 'prompt is required (1-1300 chars)' }),
  model: t.Optional(t.String()),
  size: t.Optional(t.String({ errorMessage: 'size must be a string like 2048*2048' })),
  negativePrompt: t.Optional(t.String({ maxLength: 500, errorMessage: 'negativePrompt max 500 chars' })),
  n: t.Optional(t.Integer({ minimum: 1, maximum: 6, error: 'n must be 1-6' })),
  promptExtend: t.Optional(t.Boolean()),
  watermark: t.Optional(t.Boolean()),
  seed: t.Optional(t.Integer({ minimum: 0, maximum: 2147483647, error: 'seed must be 0-2147483647' })),
})

export const ImageGenerateResponse = t.Object({
  task_id: t.String(),
  status: t.String(),
})

export const ImageTaskResponse = t.Object({
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
  size: t.Nullable(t.String()),
  negativePrompt: t.Nullable(t.String()),
  n: t.Nullable(t.Number()),
  promptExtend: t.Nullable(t.Number()),
  usage: t.Nullable(t.String()),
  cost: t.Nullable(t.Number()),
  videoUrl: t.Nullable(t.String()),
  localPath: t.Nullable(t.String()),
  errorMessage: t.Nullable(t.String()),
  createdAt: t.Nullable(t.String()),
  updatedAt: t.Nullable(t.String()),
})

export const ImageTaskListResponse = t.Array(ImageTaskResponse)

export const ImageUsageStatsResponse = t.Object({
  totalDuration: t.Number(),
  totalCost: t.Number(),
  taskCount: t.Number(),
})
