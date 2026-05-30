import type { Task } from '../../db/schema'
import type { UsageData } from '../pricing/service'
import { eq, sql } from 'drizzle-orm'
import { db } from '../../db'
import { tasks } from '../../db/schema'
import { logger } from '../../utils/logger'
import { downloadVideo } from '../../utils/storage'
import { calculateCost as dbCalculateCost } from '../pricing/service'
import { translateError } from '../task/errors'
import { getModelOrThrow } from '../task/model-registry'
import { getApiKey, isTerminal, getAllTasks as sharedGetAllTasks, getTaskByTaskId as sharedGetTaskByTaskId, getUsageStats as sharedGetUsageStats, TERMINAL_STATES } from '../task/shared'

const BASE_URL = 'https://dashscope.aliyuncs.com/api/v1'

interface CreateTaskParams {
  prompt: string
  model?: string
  imageUrl?: string
  imageUrls?: string[]
  videoUrl?: string
  resolution?: string
  ratio?: string
  duration?: number
  watermark?: boolean
  audioSetting?: string
  seed?: number
  // 万相2.7 图生视频专属
  lastFrameUrl?: string
  drivingAudioUrl?: string
  firstClipUrl?: string
  negativePrompt?: string
  promptExtend?: boolean
}

interface DashScopeCreateResult {
  task_id: string
  task_status: string
  request_id: string
}

interface DashScopeTaskResult {
  task_id: string
  task_status: string
  video_url?: string
  error_code?: string
  error_message?: string
  usage?: UsageData
}

async function callDashScopeCreate(params: CreateTaskParams): Promise<DashScopeCreateResult> {
  const model = params.model || 'happyhorse-1.0-t2v'
  const modelDef = getModelOrThrow(model)
  const subType = modelDef.subType
  const isWan27 = subType === 'wan27-i2v'
  const isVideoEdit = subType === 'edit'
  const isI2v = subType === 'i2v'
  const isR2v = subType === 'r2v'

  const input: any = { prompt: params.prompt }

  // 万相2.7 图生视频：根据参数组装 media 数组
  if (isWan27) {
    const media: { type: string, url: string }[] = []
    if (params.imageUrl)
      media.push({ type: 'first_frame', url: params.imageUrl })
    if (params.lastFrameUrl)
      media.push({ type: 'last_frame', url: params.lastFrameUrl })
    if (params.drivingAudioUrl)
      media.push({ type: 'driving_audio', url: params.drivingAudioUrl })
    if (params.firstClipUrl)
      media.push({ type: 'first_clip', url: params.firstClipUrl })
    if (media.length > 0)
      input.media = media
    if (params.negativePrompt)
      input.negative_prompt = params.negativePrompt
  }
  else if (isVideoEdit) {
    input.media = [{ type: 'video', url: params.videoUrl }]
    if (params.imageUrls?.length)
      input.media.push(...params.imageUrls.map(url => ({ type: 'reference_image', url })))
  }
  else if (isI2v && params.imageUrl) {
    input.media = [{ type: 'first_frame', url: params.imageUrl }]
  }
  else if (isR2v && params.imageUrls?.length) {
    input.media = params.imageUrls.map(url => ({ type: 'reference_image', url }))
  }

  const parameters: any = {
    resolution: params.resolution || '1080P',
  }
  if (!isI2v && !isVideoEdit && !isWan27) {
    parameters.ratio = params.ratio || '16:9'
  }
  if (!isVideoEdit) {
    parameters.duration = params.duration || 5
  }
  // 所有模型都支持 watermark 和 seed
  if (params.watermark !== undefined)
    parameters.watermark = params.watermark
  if (params.seed !== undefined)
    parameters.seed = params.seed
  // audio_setting 仅 video-edit 支持
  if (isVideoEdit && params.audioSetting)
    parameters.audio_setting = params.audioSetting
  // prompt_extend 仅万相2.7 支持
  if (isWan27 && params.promptExtend !== undefined)
    parameters.prompt_extend = params.promptExtend

  const body = { model, input, parameters }

  logger.info({ body: { ...body, input: { prompt: params.prompt.slice(0, 50), media: input.media ? '[image]' : undefined } } }, '[DashScope] Creating video task')

  const res = await fetch(`${BASE_URL}/services/aigc/video-generation/video-synthesis`, {
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
    logger.error({ code: data.code, message: data.message }, '[DashScope] Create task failed')
    throw new Error(translateError(data.code, data.message))
  }

  logger.info({ task_id: data.output.task_id, request_id: data.request_id }, '[DashScope] Task created')
  return {
    task_id: data.output.task_id,
    task_status: data.output.task_status,
    request_id: data.request_id,
  }
}

async function callDashScopeQuery(taskId: string): Promise<DashScopeTaskResult> {
  const res = await fetch(`${BASE_URL}/tasks/${taskId}`, {
    headers: { Authorization: `Bearer ${getApiKey()}` },
  })

  const data = await res.json() as any

  return {
    task_id: data.output.task_id,
    task_status: data.output.task_status,
    video_url: data.output.video_url,
    error_code: data.output.code,
    error_message: data.output.code ? translateError(data.output.code, data.output.message) : data.output.message,
    usage: data.usage || undefined,
  }
}

export abstract class VideoService {
  static async createTask(params: CreateTaskParams): Promise<{ taskId: string, status: string }> {
    logger.info({ params: { ...params, imageUrl: params.imageUrl ? '[provided]' : undefined, imageUrls: params.imageUrls?.length, videoUrl: params.videoUrl ? '[provided]' : undefined } }, '[VideoService] createTask called')

    const modelDef = getModelOrThrow(params.model || 'happyhorse-1.0-t2v')

    // 使用注册表的校验函数
    const validationError = modelDef.validate(params)
    if (validationError)
      throw new Error(validationError)

    const result = await callDashScopeCreate(params)

    // 使用注册表计算 DB 字段
    const storedImageUrl = modelDef.resolveInputImageUrl(params)
    const defaults = modelDef.defaults

    await db.insert(tasks).values({
      taskId: result.task_id,
      type: modelDef.category,
      model: params.model || 'happyhorse-1.0-t2v',
      prompt: params.prompt,
      status: result.task_status,
      resolution: params.resolution || defaults.resolution || '1080P',
      ratio: modelDef.hasRatio ? (params.ratio || defaults.ratio || null) : (defaults.ratio ?? null),
      duration: modelDef.hasDuration ? (params.duration || defaults.duration || 5) : (defaults.duration ?? null),
      inputVideoUrl: modelDef.hasInputVideo ? params.videoUrl : null,
      inputImageUrl: storedImageUrl,
      requestId: result.request_id,
    })

    logger.info({ taskId: result.task_id }, '[VideoService] Task record inserted')

    VideoService.pollUntilDone(result.task_id).catch((err) => {
      logger.error({ taskId: result.task_id, error: (err as Error).message }, '[VideoService] Background polling failed')
    })

    return { taskId: result.task_id, status: result.task_status }
  }

  static async getAllTasks(): Promise<Task[]> {
    logger.info('[VideoService] getAllTasks')
    return sharedGetAllTasks()
  }

  static async getTaskByTaskId(taskId: string): Promise<Task | undefined> {
    logger.info({ taskId }, '[VideoService] getTaskByTaskId')
    return sharedGetTaskByTaskId(taskId)
  }

  static async updateTaskStatus(
    taskId: string,
    status: string,
    videoUrl?: string,
    errorMessage?: string,
    usage?: UsageData,
  ): Promise<void> {
    logger.info({ taskId, status, videoUrl: videoUrl ? videoUrl.slice(0, 80) : undefined }, '[VideoService] Updating task status')

    // 查询任务对应的模型，用于定价计算
    let cost: number | null = null
    if (usage) {
      const taskRow = await db.select({ model: tasks.model }).from(tasks).where(eq(tasks.taskId, taskId)).get()
      const model = taskRow?.model || 'happyhorse-1.0-t2v'
      cost = await dbCalculateCost(model, usage)
    }

    await db
      .update(tasks)
      .set({
        status,
        videoUrl: videoUrl ? JSON.stringify([videoUrl]) : null,
        errorMessage: errorMessage || null,
        usage: usage ? JSON.stringify(usage) : null,
        cost,
        updatedAt: sql`(datetime('now'))`,
      })
      .where(eq(tasks.taskId, taskId))
  }

  static async downloadAndSaveVideo(taskId: string, videoUrl: string): Promise<string | null> {
    try {
      const localPath = await downloadVideo(videoUrl, taskId)
      await db
        .update(tasks)
        .set({ localPath: JSON.stringify([localPath]), updatedAt: sql`(datetime('now'))` })
        .where(eq(tasks.taskId, taskId))
      logger.info({ taskId, localPath }, '[VideoService] Local path saved to DB')
      return localPath
    }
    catch (err) {
      logger.error({ taskId, error: (err as Error).message }, '[VideoService] Failed to download video')
      return null
    }
  }

  static isTerminal = isTerminal

  static async pollTask(taskId: string): Promise<DashScopeTaskResult> {
    const result = await callDashScopeQuery(taskId)
    logger.info({ taskId, status: result.task_status }, '[DashScope] Polled task status')
    return result
  }

  static async getUsageStats(): Promise<{ totalDuration: number, totalCost: number, taskCount: number }> {
    return sharedGetUsageStats()
  }

  private static async pollUntilDone(taskId: string): Promise<void> {
    logger.info({ taskId }, '[VideoService] Background polling started')

    while (true) {
      await Bun.sleep(5000)

      const result = await callDashScopeQuery(taskId)
      logger.info({ taskId, status: result.task_status }, '[VideoService] Background poll')

      await VideoService.updateTaskStatus(
        taskId,
        result.task_status,
        result.video_url,
        result.error_message,
        result.usage,
      )

      if (result.task_status === 'SUCCEEDED' && result.video_url) {
        await VideoService.downloadAndSaveVideo(taskId, result.video_url)
      }

      if (TERMINAL_STATES.has(result.task_status)) {
        logger.info({ taskId, status: result.task_status }, '[VideoService] Background polling done')
        return
      }
    }
  }
}
