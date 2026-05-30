import { Elysia, t } from 'elysia'
import { logger } from '../../utils/logger'
import {
  BatchUpsertBody,
  PricingListResponse,
  PricingResponse,
  UpdatePricingBody,
  UpsertPricingBody,
} from './model'
import { PricingService } from './service'

export const pricingModule = new Elysia({ prefix: '/api/pricing', name: 'module:pricing' })
  .onBeforeHandle(({ request }) => {
    logger.info({ method: request.method, url: request.url }, '[API] Pricing request')
  })
  .model({
    pricingResponse: PricingResponse,
    pricingListResponse: PricingListResponse,
    upsertBody: UpsertPricingBody,
    updateBody: UpdatePricingBody,
    batchUpsertBody: BatchUpsertBody,
  })
  // 获取所有定价配置
  .get('/', async () => {
    const rows = await PricingService.getAll()
    return rows.map(row => ({
      ...row,
      actualPrice: Number((row.officialPrice * row.markup).toFixed(4)),
    }))
  }, {
    response: { 200: 'pricingListResponse' },
  })
  // 按 ID 获取单个
  .get('/:id', async ({ params: { id }, status }) => {
    const row = await PricingService.getById(id)
    if (!row)
      return status(404, { error: 'Pricing not found' })
    return {
      ...row,
      actualPrice: Number((row.officialPrice * row.markup).toFixed(4)),
    }
  }, {
    params: t.Object({ id: t.Number() }),
    response: { 200: 'pricingResponse', 404: t.Object({ error: t.String() }) },
  })
  // 新增/更新定价（单条 upsert）
  .post('/', async ({ body, set }) => {
    const row = await PricingService.upsert(body as any)
    set.status = row ? 200 : 201
    return {
      ...row,
      actualPrice: Number((row.officialPrice * row.markup).toFixed(4)),
    }
  }, {
    body: 'upsertBody',
    response: { 200: 'pricingResponse', 201: 'pricingResponse' },
  })
  // 批量 upsert
  .post('/batch', async ({ body }) => {
    const results = await Promise.all(
      (body as any[]).map(item => PricingService.upsert(item)),
    )
    return results.map(row => ({
      ...row,
      actualPrice: Number((row.officialPrice * row.markup).toFixed(4)),
    }))
  }, {
    body: 'batchUpsertBody',
  })
  // 按 ID 更新部分字段
  .put('/:id', async ({ params: { id }, body, status }) => {
    const row = await PricingService.update(id, body as any)
    if (!row)
      return status(404, { error: 'Pricing not found' })
    return {
      ...row,
      actualPrice: Number((row.officialPrice * row.markup).toFixed(4)),
    }
  }, {
    params: t.Object({ id: t.Number() }),
    body: 'updateBody',
    response: { 200: 'pricingResponse', 404: t.Object({ error: t.String() }) },
  })
  // 按 ID 删除
  .delete('/:id', async ({ params: { id }, set }) => {
    const deleted = await PricingService.delete(id)
    if (!deleted) {
      set.status = 404
      return { error: 'Pricing not found' }
    }
    return { success: true }
  }, {
    params: t.Object({ id: t.Number() }),
  })
