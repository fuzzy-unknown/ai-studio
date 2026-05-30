import type { Task } from '../../db/schema'
import { eq, sql } from 'drizzle-orm'
import { db } from '../../db'
import { tasks } from '../../db/schema'
import { logger } from '../../utils/logger'
import { downloadImage } from '../../utils/storage'
import { calculateImageCost } from '../pricing/service'
import { translateError } from '../task/errors'
import { isEditModel as isImageEditModel, isSyncImageModel } from '../task/model-registry'
import { getApiKey, isTerminal, getAllTasks as sharedGetAllTasks, getTaskByTaskId as sharedGetTaskByTaskId, getUsageStats as sharedGetUsageStats, TERMINAL_STATES } from '../task/shared'

const BASE_URL = 'https://dashscope.aliyuncs.com/api/v1'

interface CreateImageTaskParams {
  prompt: string
  model?: string
  size?: string
  negativePrompt?: string
  n?: number
  promptExtend?: boolean
  watermark?: boolean
  seed?: number
  // 图像编辑：输入图片 URL（1-3 张）
  imageUrls?: string[]
}

function serializeInputImages(imageUrls: string[] | undefined): string | null {
  if (!imageUrls || imageUrls.length === 0)
    return null
  return JSON.stringify(imageUrls.map(url => ({ type: 'input_image', url })))
}

// ---- DashScope sync call (qwen-image-2.0 series) ----

async function callDashScopeSync(params: CreateImageTaskParams): Promise<{
  imageUrls: string[]
  imageCount: number
  width: number
  height: number
  requestId: string
}> {
  const model = params.model || 'qwen-image-2.0-pro'
  const edit = isImageEditModel(model) || (params.imageUrls && params.imageUrls.length > 0)

  // 构建 content 数组：编辑模式先放图片再放文字
  const content: any[] = []
  if (edit && params.imageUrls) {
    for (const url of params.imageUrls)
      content.push({ image: url })
  }
  content.push({ text: params.prompt })

  const body: any = {
    model,
    input: {
      messages: [
        {
          role: 'user',
          content,
        },
      ],
    },
    parameters: {} as any,
  }

  if (params.size && model !== 'qwen-image-edit')
    body.parameters.size = params.size
  if (params.negativePrompt)
    body.parameters.negative_prompt = params.negativePrompt
  if (params.n && isSyncImageModel(model))
    body.parameters.n = params.n
  // qwen-image-edit 不支持 prompt_extend 参数
  if (model !== 'qwen-image-edit') {
    if (params.promptExtend !== undefined)
      body.parameters.prompt_extend = params.promptExtend
    else
      body.parameters.prompt_extend = true
  }
  if (params.watermark !== undefined)
    body.parameters.watermark = params.watermark
  if (params.seed !== undefined)
    body.parameters.seed = params.seed

  logger.info({ model, promptLen: params.prompt.length, inputImages: params.imageUrls?.length || 0 }, '[DashScope-Image] Sync call')

  const res = await fetch(`${BASE_URL}/services/aigc/multimodal-generation/generation`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getApiKey()}`,
    },
    body: JSON.stringify(body),
  })

  const data = await res.json() as any

  if (data.code) {
    logger.error({ code: data.code, message: data.message }, '[DashScope-Image] Sync call failed')
    throw new Error(translateError(data.code, data.message))
  }

  // 提取所有图片 URL（支持 n > 1）
  const contents = data.output.choices[0].message.content as any[]
  const imageUrls = contents
    .filter((c: any) => c.image)
    .map((c: any) => c.image as string)
  const usage = data.usage || {}

  logger.info({ requestId: data.request_id, imageCount: usage.image_count || imageUrls.length }, '[DashScope-Image] Sync success')

  return {
    imageUrls,
    imageCount: usage.image_count || imageUrls.length,
    width: usage.width || 0,
    height: usage.height || 0,
    requestId: data.request_id,
  }
}

// ---- DashScope async call (qwen-image-max, qwen-image-plus) ----

async function callDashScopeAsync(params: CreateImageTaskParams): Promise<{
  task_id: string
  task_status: string
  request_id: string
}> {
  const model = params.model || 'qwen-image-plus'

  const body: any = {
    model,
    input: { prompt: params.prompt } as any,
    parameters: {} as any,
  }

  if (params.size)
    body.parameters.size = params.size
  // 异步接口的 negative_prompt 放在 input 里（文档明确要求）
  if (params.negativePrompt)
    body.input.negative_prompt = params.negativePrompt
  if (params.promptExtend !== undefined)
    body.parameters.prompt_extend = params.promptExtend
  else
    body.parameters.prompt_extend = true
  if (params.watermark !== undefined)
    body.parameters.watermark = params.watermark
  if (params.seed !== undefined)
    body.parameters.seed = params.seed

  logger.info({ model, promptLen: params.prompt.length }, '[DashScope-Image] Async call')

  const res = await fetch(`${BASE_URL}/services/aigc/text2image/image-synthesis`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getApiKey()}`,
      'X-DashScope-Async': 'enable',
    },
    body: JSON.stringify(body),
  })

  const data = await res.json() as any

  if (data.code) {
    logger.error({ code: data.code, message: data.message }, '[DashScope-Image] Async call failed')
    throw new Error(translateError(data.code, data.message))
  }

  logger.info({ task_id: data.output.task_id }, '[DashScope-Image] Async task created')

  return {
    task_id: data.output.task_id,
    task_status: data.output.task_status,
    request_id: data.request_id,
  }
}

// ---- DashScope async query ----

async function callDashScopeQuery(taskId: string): Promise<{
  task_id: string
  task_status: string
  image_urls: string[]
  error_code?: string
  error_message?: string
  image_count?: number
}> {
  const res = await fetch(`${BASE_URL}/tasks/${taskId}`, {
    headers: { Authorization: `Bearer ${getApiKey()}` },
  })

  const data = await res.json() as any

  // 提取所有图片 URL（支持多图结果）
  const results = data.output?.results || []
  const imageUrls = results
    .filter((r: any) => r.url)
    .map((r: any) => r.url as string)
  const errorCode = data.output?.code
  const errorMsg = errorCode ? translateError(errorCode, data.output.message) : undefined

  return {
    task_id: data.output?.task_id,
    task_status: data.output?.task_status,
    image_urls: imageUrls,
    error_code: errorCode,
    error_message: errorMsg,
    image_count: data.usage?.image_count || imageUrls.length,
  }
}

// ---- Service class ----

export abstract class ImageService {
  static async createTask(params: CreateImageTaskParams): Promise<{ taskId: string, status: string }> {
    const model = params.model || 'qwen-image-2.0-pro'
    const sync = isSyncImageModel(model)

    logger.info({ model, sync }, '[ImageService] createTask called')

    if (sync) {
      // 同步模式：直接拿到结果
      const result = await callDashScopeSync(params)

      const cost = await calculateImageCost(model, result.imageCount)

      // 生成一个本地 taskId
      const localTaskId = `sync-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

      // 下载所有图片到本地
      const localPaths: string[] = []
      for (let i = 0; i < result.imageUrls.length; i++) {
        const suffix = result.imageUrls.length > 1 ? `_${i}` : ''
        try {
          const path = await downloadImage(result.imageUrls[i], `${localTaskId}${suffix}`)
          localPaths.push(path)
        }
        catch (err) {
          logger.error({ taskId: localTaskId, index: i, error: (err as Error).message }, '[ImageService] Failed to download image')
        }
      }

      // videoUrl/localPath 统一存 JSON 数组
      const videoUrl = JSON.stringify(result.imageUrls)
      const localPath = localPaths.length > 0 ? JSON.stringify(localPaths) : null

      await db.insert(tasks).values({
        taskId: localTaskId,
        type: 'image',
        model,
        prompt: params.prompt,
        status: 'SUCCEEDED',
        resolution: params.size || null,
        videoUrl,
        localPath,
        inputImageUrl: serializeInputImages(params.imageUrls),
        size: params.size || null,
        negativePrompt: params.negativePrompt || null,
        n: result.imageCount,
        promptExtend: params.promptExtend !== false ? 1 : 0,
        requestId: result.requestId,
        cost,
        usage: JSON.stringify({ image_count: result.imageCount, width: result.width, height: result.height }),
      })

      return { taskId: localTaskId, status: 'SUCCEEDED' }
    }
    else {
      // 异步模式：提交任务后轮询
      const result = await callDashScopeAsync(params)

      await db.insert(tasks).values({
        taskId: result.task_id,
        type: 'image',
        model,
        prompt: params.prompt,
        status: result.task_status,
        resolution: params.size || null,
        size: params.size || null,
        negativePrompt: params.negativePrompt || null,
        n: params.n || 1,
        promptExtend: params.promptExtend !== false ? 1 : 0,
        requestId: result.request_id,
      })

      logger.info({ taskId: result.task_id }, '[ImageService] Async task record inserted')

      ImageService.pollUntilDone(result.task_id).catch((err) => {
        logger.error({ taskId: result.task_id, error: (err as Error).message }, '[ImageService] Background polling failed')
      })

      return { taskId: result.task_id, status: result.task_status }
    }
  }

  static async getAllTasks(): Promise<Task[]> {
    return sharedGetAllTasks()
  }

  static async getTaskByTaskId(taskId: string): Promise<Task | undefined> {
    return sharedGetTaskByTaskId(taskId)
  }

  static async updateTaskStatus(
    taskId: string,
    status: string,
    imageUrls: string[],
    errorMessage?: string,
    imageCount?: number,
  ): Promise<void> {
    logger.info({ taskId, status }, '[ImageService] Updating task status')

    let cost: number | null = null
    if (status === 'SUCCEEDED' && imageCount) {
      const taskRow = await db.select({ model: tasks.model }).from(tasks).where(eq(tasks.taskId, taskId)).get()
      const model = taskRow?.model || 'qwen-image-plus'
      cost = await calculateImageCost(model, imageCount)
    }

    // videoUrl: 统一存 JSON 数组
    const videoUrl = imageUrls.length > 0 ? JSON.stringify(imageUrls) : null

    await db
      .update(tasks)
      .set({
        status,
        videoUrl,
        errorMessage: errorMessage || null,
        cost,
        usage: imageCount ? JSON.stringify({ image_count: imageCount }) : null,
        updatedAt: sql`(datetime('now'))`,
      })
      .where(eq(tasks.taskId, taskId))
  }

  static async downloadAndSaveImages(taskId: string, imageUrls: string[]): Promise<string | null> {
    try {
      const localPaths: string[] = []
      for (let i = 0; i < imageUrls.length; i++) {
        const suffix = imageUrls.length > 1 ? `_${i}` : ''
        const path = await downloadImage(imageUrls[i], `${taskId}${suffix}`)
        localPaths.push(path)
      }
      const localPath = localPaths.length > 0 ? JSON.stringify(localPaths) : null
      await db
        .update(tasks)
        .set({ localPath, updatedAt: sql`(datetime('now'))` })
        .where(eq(tasks.taskId, taskId))
      return localPath
    }
    catch (err) {
      logger.error({ taskId, error: (err as Error).message }, '[ImageService] Failed to download images')
      return null
    }
  }

  static isTerminal = isTerminal

  static async pollTask(taskId: string) {
    return callDashScopeQuery(taskId)
  }

  static async getUsageStats(): Promise<{ totalDuration: number, totalCost: number, taskCount: number }> {
    return sharedGetUsageStats()
  }

  private static async pollUntilDone(taskId: string): Promise<void> {
    logger.info({ taskId }, '[ImageService] Background polling started')

    while (true) {
      await Bun.sleep(5000)

      const result = await callDashScopeQuery(taskId)
      logger.info({ taskId, status: result.task_status }, '[ImageService] Background poll')

      await ImageService.updateTaskStatus(
        taskId,
        result.task_status,
        result.image_urls,
        result.error_message,
        result.image_count,
      )

      if (result.task_status === 'SUCCEEDED' && result.image_urls.length > 0) {
        await ImageService.downloadAndSaveImages(taskId, result.image_urls)
      }

      if (TERMINAL_STATES.has(result.task_status)) {
        logger.info({ taskId, status: result.task_status }, '[ImageService] Background polling done')
        return
      }
    }
  }
}
