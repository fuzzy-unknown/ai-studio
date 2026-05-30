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

export const pricingModule = new Elysia({ prefix: '/api/pricing', name: 'module:pricing', tags: ['定价管理'] })
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
  .get('/', async () => {
    const rows = await PricingService.getAll()
    return rows.map(row => ({
      ...row,
      actualPrice: Number((row.officialPrice * row.markup).toFixed(4)),
    }))
  }, {
    response: { 200: 'pricingListResponse' },
    detail: {
      summary: '获取所有定价配置',
      description: '查询所有模型×分辨率定价配置，含计算后的实际价格（actualPrice = officialPrice × markup）。',
    },
  })
  .get('/:id', async ({ params: { id }, status }) => {
    const row = await PricingService.getById(id)
    if (!row)
      return status(404, { error: 'Pricing not found' })
    return {
      ...row,
      actualPrice: Number((row.officialPrice * row.markup).toFixed(4)),
    }
  }, {
    params: t.Object({ id: t.Number({ description: '定价记录 ID' }) }),
    response: { 200: 'pricingResponse', 404: t.Object({ error: t.String() }) },
    detail: {
      summary: '按 ID 获取定价',
      description: '根据定价记录 ID 获取单条定价配置，含计算后的实际价格。',
    },
  })
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
    detail: {
      summary: '新增或更新定价',
      description: '按 model + resolution 组合进行 upsert。若该组合已存在则更新，不存在则创建。返回更新后的定价记录。',
    },
  })
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
    detail: {
      summary: '批量新增或更新定价',
      description: '批量执行 upsert 操作，接收数组，每项按 model + resolution 组合进行新增或更新。',
    },
  })
  .put('/:id', async ({ params: { id }, body, status }) => {
    const row = await PricingService.update(id, body as any)
    if (!row)
      return status(404, { error: 'Pricing not found' })
    return {
      ...row,
      actualPrice: Number((row.officialPrice * row.markup).toFixed(4)),
    }
  }, {
    params: t.Object({ id: t.Number({ description: '定价记录 ID' }) }),
    body: 'updateBody',
    response: { 200: 'pricingResponse', 404: t.Object({ error: t.String() }) },
    detail: {
      summary: '按 ID 更新定价',
      description: '根据定价记录 ID 更新官方价格（officialPrice）和/或加价倍率（markup）。支持部分更新。',
    },
  })
  .delete('/:id', async ({ params: { id }, set }) => {
    const deleted = await PricingService.delete(id)
    if (!deleted) {
      set.status = 404
      return { error: 'Pricing not found' }
    }
    return { success: true }
  }, {
    params: t.Object({ id: t.Number({ description: '定价记录 ID' }) }),
    detail: {
      summary: '按 ID 删除定价',
      description: '根据定价记录 ID 删除定价配置。',
    },
  })
