/**
 * 共享错误码翻译 — 合并 video 和 image 模块的 ERROR_CODE_MAP（取并集）
 */

export const ERROR_CODE_MAP: Record<string, string> = {
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

export function translateError(code: string, message: string): string {
  const zh = ERROR_CODE_MAP[code]
  return zh || `[${code}] ${message}`
}
