import type { Task } from '../../db/schema'
import process from 'node:process'
import { desc, eq, sql } from 'drizzle-orm'
import { db } from '../../db'
import { tasks } from '../../db/schema'
import { calculateCost as dbCalculateCost } from '../pricing/service'
import type { UsageData } from '../pricing/service'
import { logger } from '../../utils/logger'
import { downloadVideo } from '../../utils/storage'

const BASE_URL = 'https://dashscope.aliyuncs.com/api/v1'
const TERMINAL_STATES = new Set(['SUCCEEDED', 'FAILED', 'UNKNOWN', 'CANCELED'])
const I2V_MODEL = 'happyhorse-1.0-i2v'
const R2V_MODEL = 'happyhorse-1.0-r2v'
const VIDEO_EDIT_MODEL = 'happyhorse-1.0-video-edit'
const WAN27_I2V_MODEL = 'wan2.7-i2v-2026-04-25'

const ERROR_CODE_MAP: Record<string, string> = {
  'InvalidApiKey': 'API Key 无效，请检查 DASHSCOPE_API_KEY 配置',
  'Arrearage': '阿里云账号欠费，请前往费用中心充值',
  'ModelNotFound': '模型不存在，请检查模型名称',
  'AccessDenied': '无权访问该模型，请检查权限或开通百炼服务',
  'AccessDenied.Unpurchased': '未开通阿里云百炼服务',
  'InvalidParameter': '请求参数错误，请检查输入内容',
  'DataInspectionFailed': '内容未通过安全审核，请修改输入内容',
  'data_inspection_failed': '内容未通过安全审核，请修改输入内容',
  'IPInfringementSuspect': '输入内容涉嫌知识产权侵权，请修改后重试',
  'Throttling': '请求过于频繁，请稍后重试',
  'Throttling.RateQuota': '已超过调用频率限制，请稍后重试',
  'Throttling.AllocationQuota': '已超过配额限制，请检查用量',
  'Throttling.BurstRate': '请求频率增长过快，请平滑调用',
  'InternalError': '服务端内部错误，请稍后重试',
  'InternalError.Algo': '算法推理失败，请稍后重试',
  'InternalError.Timeout': '请求超时，请稍后重试',
  'InvalidURL': '图片 URL 无效或无法访问',
  'InvalidFile.DownloadFailed': '图片文件下载失败，请检查 URL 是否可访问',
  'InvalidFile.Format': '文件格式不支持，请使用 JPEG/PNG/WEBP',
  'InvalidFile.Size': '文件大小超出限制',
  'InvalidFile.Resolution': '图片分辨率不符合要求',
  'FlowNotPublished': '应用流程未发布',
}

function translateError(code: string, message: string): string {
  const zh = ERROR_CODE_MAP[code]
  return zh || `[${code}] ${message}`
}

function getApiKey(): string {
  const key = process.env.DASHSCOPE_API_KEY
  if (!key)
    throw new Error('DASHSCOPE_API_KEY is not set')
  return key
}

function isI2v(model?: string): boolean {
  return model === I2V_MODEL
}

function isR2v(model?: string): boolean {
  return model === R2V_MODEL
}

function isVideoEdit(model?: string): boolean {
  return model === VIDEO_EDIT_MODEL
}

function isWan27I2v(model?: string): boolean {
  return model === WAN27_I2V_MODEL
}

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
  const i2v = isI2v(model)
  const r2v = isR2v(model)
  const videoEdit = isVideoEdit(model)
  const wan27 = isWan27I2v(model)

  const input: any = { prompt: params.prompt }

  // 万相2.7 图生视频：根据参数组装 media 数组
  if (wan27) {
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
  else if (videoEdit) {
    input.media = [{ type: 'video', url: params.videoUrl }]
    if (params.imageUrls?.length)
      input.media.push(...params.imageUrls.map(url => ({ type: 'reference_image', url })))
  }
  else if (i2v && params.imageUrl) {
    input.media = [{ type: 'first_frame', url: params.imageUrl }]
  }
  else if (r2v && params.imageUrls?.length) {
    input.media = params.imageUrls.map(url => ({ type: 'reference_image', url }))
  }

  const parameters: any = {
    resolution: params.resolution || '1080P',
  }
  if (!i2v && !videoEdit && !wan27) {
    parameters.ratio = params.ratio || '16:9'
  }
  if (!videoEdit) {
    parameters.duration = params.duration || 5
  }
  // 所有模型都支持 watermark 和 seed
  if (params.watermark !== undefined)
    parameters.watermark = params.watermark
  if (params.seed !== undefined)
    parameters.seed = params.seed
  // audio_setting 仅 video-edit 支持
  if (videoEdit && params.audioSetting)
    parameters.audio_setting = params.audioSetting
  // prompt_extend 仅万相2.7 支持
  if (wan27 && params.promptExtend !== undefined)
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

    const i2v = isI2v(params.model)
    const r2v = isR2v(params.model)
    const videoEdit = isVideoEdit(params.model)
    const wan27 = isWan27I2v(params.model)
    if (i2v && !params.imageUrl)
      throw new Error('imageUrl is required for image-to-video model')
    if (r2v && (!params.imageUrls || params.imageUrls.length === 0))
      throw new Error('imageUrls is required for reference-to-video model')
    if (videoEdit && !params.videoUrl)
      throw new Error('videoUrl is required for video-edit model')
    if (wan27 && !params.imageUrl && !params.firstClipUrl)
      throw new Error('imageUrl or firstClipUrl is required for wan2.7-i2v model')

    const result = await callDashScopeCreate(params)

    const storedImageUrl = wan27
      ? JSON.stringify([params.imageUrl, params.lastFrameUrl, params.drivingAudioUrl, params.firstClipUrl].filter(Boolean))
      : r2v || videoEdit
        ? (params.imageUrls && params.imageUrls.length > 0 ? JSON.stringify(params.imageUrls) : null)
        : (params.imageUrl || null)

    await db.insert(tasks).values({
      taskId: result.task_id,
      model: params.model || 'happyhorse-1.0-t2v',
      prompt: params.prompt,
      status: result.task_status,
      resolution: params.resolution || '1080P',
      ratio: i2v || videoEdit ? null : (params.ratio || '16:9'),
      duration: videoEdit ? null : (params.duration || 5),
      inputVideoUrl: videoEdit ? params.videoUrl : null,
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
    return db.select().from(tasks).orderBy(desc(tasks.createdAt)).all()
  }

  static async getTaskByTaskId(taskId: string): Promise<Task | undefined> {
    logger.info({ taskId }, '[VideoService] getTaskByTaskId')
    return db.select().from(tasks).where(eq(tasks.taskId, taskId)).get()
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
        videoUrl: videoUrl || null,
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
        .set({ localPath, updatedAt: sql`(datetime('now'))` })
        .where(eq(tasks.taskId, taskId))
      logger.info({ taskId, localPath }, '[VideoService] Local path saved to DB')
      return localPath
    }
    catch (err) {
      logger.error({ taskId, error: (err as Error).message }, '[VideoService] Failed to download video')
      return null
    }
  }

  static isTerminal(status: string): boolean {
    return TERMINAL_STATES.has(status)
  }

  static async pollTask(taskId: string): Promise<DashScopeTaskResult> {
    const result = await callDashScopeQuery(taskId)
    logger.info({ taskId, status: result.task_status }, '[DashScope] Polled task status')
    return result
  }

  static async getUsageStats(): Promise<{ totalDuration: number, totalCost: number, taskCount: number }> {
    const allTasks = await db.select().from(tasks).all()
    let totalDuration = 0
    let totalCost = 0
    let taskCount = 0
    for (const task of allTasks) {
      if (task.status === 'SUCCEEDED' && task.cost != null) {
        // 使用 DB 中已存储的 cost，与 TaskCard 显示一致
        totalCost += task.cost
        taskCount++
        // duration 从 usage 中提取
        if (task.usage) {
          const usage = JSON.parse(task.usage) as UsageData
          totalDuration += usage.duration
        }
      }
    }
    return { totalDuration, totalCost: Number(totalCost.toFixed(4)), taskCount }
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
