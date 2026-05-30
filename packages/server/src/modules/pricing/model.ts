import { t } from 'elysia'

export const PricingResponse = t.Object({
  id: t.Number(),
  model: t.String(),
  resolution: t.String(),
  officialPrice: t.Number(),
  markup: t.Number(),
  actualPrice: t.Number(),
  createdAt: t.Nullable(t.String()),
  updatedAt: t.Nullable(t.String()),
})

export const PricingListResponse = t.Array(PricingResponse)

export const UpsertPricingBody = t.Object({
  model: t.String({ minLength: 1, errorMessage: 'model is required' }),
  resolution: t.String({ minLength: 1, errorMessage: 'resolution is required' }),
  officialPrice: t.Number({ minimum: 0, errorMessage: 'officialPrice must be >= 0' }),
  markup: t.Number({ minimum: 1, errorMessage: 'markup must be >= 1' }),
})

export const UpdatePricingBody = t.Object({
  officialPrice: t.Optional(t.Number({ minimum: 0, errorMessage: 'officialPrice must be >= 0' })),
  markup: t.Optional(t.Number({ minimum: 1, errorMessage: 'markup must be >= 1' })),
})

export const BatchUpsertBody = t.Array(UpsertPricingBody)
