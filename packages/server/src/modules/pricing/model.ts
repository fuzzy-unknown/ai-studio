import { t } from 'elysia'

export const PricingResponse = t.Object({
  id: t.Number({ description: '定价记录 ID' }),
  model: t.String({ description: '模型 ID，如 happyhorse-1.0-t2v、qwen-image-2.0-pro' }),
  resolution: t.String({ description: '分辨率，如 720P、1080P、2048*2048' }),
  officialPrice: t.Number({ description: '官方单价（元/秒 或 元/张）' }),
  markup: t.Number({ description: '加价倍率，≥ 1.0' }),
  actualPrice: t.Number({ description: '实际价格 = officialPrice × markup' }),
  createdAt: t.Nullable(t.String({ description: '创建时间（ISO 8601）' })),
  updatedAt: t.Nullable(t.String({ description: '更新时间（ISO 8601）' })),
})

export const PricingListResponse = t.Array(PricingResponse)

export const UpsertPricingBody = t.Object({
  model: t.String({ description: '模型 ID', minLength: 1, errorMessage: 'model is required' }),
  resolution: t.String({ description: '分辨率，如 720P、1080P、2048*2048', minLength: 1, errorMessage: 'resolution is required' }),
  officialPrice: t.Number({ description: '官方单价（元/秒 或 元/张），≥ 0', minimum: 0, errorMessage: 'officialPrice must be >= 0' }),
  markup: t.Number({ description: '加价倍率，≥ 1.0', minimum: 1, errorMessage: 'markup must be >= 1' }),
})

export const UpdatePricingBody = t.Object({
  officialPrice: t.Optional(t.Number({ description: '官方单价（元/秒 或 元/张），≥ 0', minimum: 0, errorMessage: 'officialPrice must be >= 0' })),
  markup: t.Optional(t.Number({ description: '加价倍率，≥ 1.0', minimum: 1, errorMessage: 'markup must be >= 1' })),
})

export const BatchUpsertBody = t.Array(UpsertPricingBody)
