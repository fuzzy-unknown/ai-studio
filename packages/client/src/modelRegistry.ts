import type { Category, ModelType } from './components/GenerateForm/constants'

export interface ClientModelDefinition {
  id: string
  category: Category
  formType: ModelType
  label: string
  generateEndpoint: '/api/video/generate' | '/api/image/generate'
}

const MODELS: Record<string, ClientModelDefinition> = {
  'happyhorse-1.0-t2v': {
    id: 'happyhorse-1.0-t2v',
    category: 'video',
    formType: 't2v',
    label: '文生视频',
    generateEndpoint: '/api/video/generate',
  },
  'happyhorse-1.0-i2v': {
    id: 'happyhorse-1.0-i2v',
    category: 'video',
    formType: 'i2v',
    label: '图生视频',
    generateEndpoint: '/api/video/generate',
  },
  'happyhorse-1.0-r2v': {
    id: 'happyhorse-1.0-r2v',
    category: 'video',
    formType: 'r2v',
    label: '参考生视频',
    generateEndpoint: '/api/video/generate',
  },
  'happyhorse-1.0-video-edit': {
    id: 'happyhorse-1.0-video-edit',
    category: 'video',
    formType: 'edit',
    label: '视频编辑',
    generateEndpoint: '/api/video/generate',
  },
  'wan2.7-i2v-2026-04-25': {
    id: 'wan2.7-i2v-2026-04-25',
    category: 'video',
    formType: 'wan27-i2v',
    label: '万相2.7 图生视频',
    generateEndpoint: '/api/video/generate',
  },
  'qwen-image-2.0-pro': {
    id: 'qwen-image-2.0-pro',
    category: 'image',
    formType: 't2i',
    label: '文生图 Pro',
    generateEndpoint: '/api/image/generate',
  },
  'qwen-image-2.0': {
    id: 'qwen-image-2.0',
    category: 'image',
    formType: 't2i',
    label: '文生图 2.0',
    generateEndpoint: '/api/image/generate',
  },
  'qwen-image-max': {
    id: 'qwen-image-max',
    category: 'image',
    formType: 't2i',
    label: '文生图 Max',
    generateEndpoint: '/api/image/generate',
  },
  'qwen-image-plus': {
    id: 'qwen-image-plus',
    category: 'image',
    formType: 't2i',
    label: '文生图 Plus',
    generateEndpoint: '/api/image/generate',
  },
  'qwen-image': {
    id: 'qwen-image',
    category: 'image',
    formType: 't2i',
    label: '文生图',
    generateEndpoint: '/api/image/generate',
  },
  'qwen-image-edit-max': {
    id: 'qwen-image-edit-max',
    category: 'image',
    formType: 'i2i',
    label: '图生图 Edit Max',
    generateEndpoint: '/api/image/generate',
  },
  'qwen-image-edit-plus': {
    id: 'qwen-image-edit-plus',
    category: 'image',
    formType: 'i2i',
    label: '图生图 Edit Plus',
    generateEndpoint: '/api/image/generate',
  },
  'qwen-image-edit': {
    id: 'qwen-image-edit',
    category: 'image',
    formType: 'i2i',
    label: '图生图 Edit',
    generateEndpoint: '/api/image/generate',
  },
}

export function getClientModel(modelId: string | null | undefined): ClientModelDefinition | undefined {
  return modelId ? MODELS[modelId] : undefined
}

export function getTaskCategory(task: { type?: string | null, model?: string | null }): Category {
  if (task.type === 'image' || task.type === 'video')
    return task.type
  return getClientModel(task.model)?.category ?? 'video'
}

export function isImageTaskLike(task: { type?: string | null, model?: string | null }): boolean {
  return getTaskCategory(task) === 'image'
}

export function getGenerateEndpoint(modelId: string): ClientModelDefinition['generateEndpoint'] {
  return getClientModel(modelId)?.generateEndpoint ?? '/api/video/generate'
}

export function getModelLabel(modelId: string | null | undefined): string {
  return getClientModel(modelId)?.label ?? modelId ?? ''
}

export function hasFormType(modelId: string | null | undefined, formType: ModelType): boolean {
  return getClientModel(modelId)?.formType === formType
}

export function isV2ImageModel(modelId: string): boolean {
  return modelId === 'qwen-image-2.0-pro' || modelId === 'qwen-image-2.0'
}
