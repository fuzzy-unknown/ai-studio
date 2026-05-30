import type { Pricing } from '../../db/schema'
import { eq, and } from 'drizzle-orm'
import { db } from '../../db'
import { pricing } from '../../db/schema'
import { logger } from '../../utils/logger'

export interface UsageData {
  duration: number
  input_video_duration: number
  output_video_duration: number
  video_count: number
  SR: number
}

/** 获取模型 × 分辨率的实际单价（officialPrice × markup） */
export async function getPricePerSecond(model: string, sr: number): Promise<number> {
  const srKey = `${sr}`
  const row = await db
    .select()
    .from(pricing)
    .where(and(eq(pricing.model, model), eq(pricing.resolution, srKey)))
    .get()

  if (!row) {
    logger.warn({ model, sr: srKey }, '[Pricing] No pricing found, using 0')
    return 0
  }

  return Number((row.officialPrice * row.markup).toFixed(4))
}

/** 计算任务费用（元） */
export async function calculateCost(model: string, usage: UsageData): Promise<number> {
  const pricePerSec = await getPricePerSecond(model, usage.SR)
  return Number((usage.duration * pricePerSec).toFixed(4))
}

/** 计算图片任务费用（元/张） */
export async function calculateImageCost(model: string, imageCount: number): Promise<number> {
  // 查询第一个匹配的定价记录作为单价
  const row = await db
    .select()
    .from(pricing)
    .where(eq(pricing.model, model))
    .get()

  if (!row) {
    logger.warn({ model }, '[Pricing] No image pricing found, using 0')
    return 0
  }

  return Number((imageCount * row.officialPrice * row.markup).toFixed(4))
}

export abstract class PricingService {
  /** 获取所有定价配置 */
  static async getAll(): Promise<Pricing[]> {
    return db.select().from(pricing).orderBy(pricing.model, pricing.resolution).all()
  }

  /** 按 ID 获取 */
  static async getById(id: number): Promise<Pricing | undefined> {
    return db.select().from(pricing).where(eq(pricing.id, id)).get()
  }

  /** 新增或更新定价（按 model+resolution 唯一键） */
  static async upsert(params: { model: string, resolution: string, officialPrice: number, markup: number }): Promise<Pricing> {
    const existing = await db
      .select()
      .from(pricing)
      .where(and(eq(pricing.model, params.model), eq(pricing.resolution, params.resolution)))
      .get()

    if (existing) {
      await db
        .update(pricing)
        .set({
          officialPrice: params.officialPrice,
          markup: params.markup,
          updatedAt: new Date().toISOString().replace('T', ' ').split('.')[0],
        })
        .where(eq(pricing.id, existing.id))
      logger.info({ model: params.model, resolution: params.resolution }, '[Pricing] Updated')
      return (await db.select().from(pricing).where(eq(pricing.id, existing.id)).get())!
    }

    const result = await db
      .insert(pricing)
      .values({
        model: params.model,
        resolution: params.resolution,
        officialPrice: params.officialPrice,
        markup: params.markup,
      })
      .returning()

    logger.info({ model: params.model, resolution: params.resolution }, '[Pricing] Created')
    return result[0]
  }

  /** 按 ID 更新部分字段 */
  static async update(id: number, data: { officialPrice?: number, markup?: number }): Promise<Pricing | null> {
    const existing = await db.select().from(pricing).where(eq(pricing.id, id)).get()
    if (!existing)
      return null

    await db
      .update(pricing)
      .set({
        ...(data.officialPrice !== undefined && { officialPrice: data.officialPrice }),
        ...(data.markup !== undefined && { markup: data.markup }),
        updatedAt: new Date().toISOString().replace('T', ' ').split('.')[0],
      })
      .where(eq(pricing.id, id))

    logger.info({ id }, '[Pricing] Updated')
    return db.select().from(pricing).where(eq(pricing.id, id)).get()
  }

  /** 按 ID 删除 */
  static async delete(id: number): Promise<boolean> {
    const existing = await db.select().from(pricing).where(eq(pricing.id, id)).get()
    if (!existing)
      return false

    await db.delete(pricing).where(eq(pricing.id, id))
    logger.info({ id }, '[Pricing] Deleted')
    return true
  }
}
