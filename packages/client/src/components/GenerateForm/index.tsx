import { useCallback, useEffect, useRef, useState } from 'react'
import { CATEGORIES, MODEL_GROUPS } from './constants'
import type { Category } from './constants'
import type { GenerateFormData } from './types'
import { HappyHorseEditForm } from './forms/HappyHorseEditForm'
import { HappyHorseI2vForm } from './forms/HappyHorseI2vForm'
import { HappyHorseR2vForm } from './forms/HappyHorseR2vForm'
import { HappyHorseT2vForm } from './forms/HappyHorseT2vForm'
import { Wan27I2vForm } from './forms/Wan27I2vForm'
import { QwenImageEditForm } from './forms/QwenImageEditForm'
import { QwenImageForm } from './forms/QwenImageForm'

interface Props {
  onSubmit: (data: GenerateFormData) => void
  loading: boolean
  /** 重试时回填的数据 */
  retryData?: Partial<GenerateFormData> | null
  /** 重试数据被消费后的回调 */
  onRetryConsumed?: () => void
}

/** 在 MODEL_GROUPS 中查找模型的三级位置 */
function findModelPosition(modelId: string): { category: Category, subTypeIndex: number, modelIndex: number } | null {
  for (const [cat, subTypes] of Object.entries(MODEL_GROUPS)) {
    for (let si = 0; si < subTypes.length; si++) {
      for (let mi = 0; mi < subTypes[si].models.length; mi++) {
        if (subTypes[si].models[mi].value === modelId) {
          return { category: cat as Category, subTypeIndex: si, modelIndex: mi }
        }
      }
    }
  }
  return null
}

export function GenerateForm({ onSubmit, loading, retryData, onRetryConsumed }: Props) {
  // 一级：分类 Tab
  const [category, setCategory] = useState<Category>('video')
  const subTypes = MODEL_GROUPS[category]

  // 二级：功能 Tab
  const [subTypeIndex, setSubTypeIndex] = useState(0)
  const currentSubType = subTypes[Math.min(subTypeIndex, subTypes.length - 1)]

  // 三级：模型下拉（始终显示，方便后续扩展）
  const models = currentSubType.models
  const [modelIndex, setModelIndex] = useState(0)
  const currentModel = models[Math.min(modelIndex, models.length - 1)]

  const formType = currentModel.formType

  // 重试：保存回填数据（独立于 retryData 生命周期，避免被 onRetryConsumed 清空）
  const [initialData, setInitialData] = useState<Partial<GenerateFormData> | null>(null)
  // 重试 key：每次重试递增，强制表单重新挂载以消费 initialData
  const [retryKey, setRetryKey] = useState(0)
  const onRetryConsumedRef = useRef(onRetryConsumed)
  onRetryConsumedRef.current = onRetryConsumed

  useEffect(() => {
    if (!retryData?.model)
      return
    const pos = findModelPosition(retryData.model)
    if (pos) {
      setCategory(pos.category)
      setSubTypeIndex(pos.subTypeIndex)
      setModelIndex(pos.modelIndex)
    }
    setInitialData(retryData)
    setRetryKey(k => k + 1)
    onRetryConsumedRef.current?.()
  }, [retryData])

  // 切换分类时重置二级和三级
  const handleCategoryChange = useCallback((cat: Category) => {
    setCategory(cat)
    setSubTypeIndex(0)
    setModelIndex(0)
  }, [])

  // 切换二级时重置三级
  const handleSubTypeChange = useCallback((idx: number) => {
    setSubTypeIndex(idx)
    setModelIndex(0)
  }, [])

  const formKey = `${currentModel.value}-${retryKey}`

  return (
    <form className="generate-form" onSubmit={e => e.preventDefault()}>
      {/* 一级分类 Tab */}
      <div className="category-tabs">
        {CATEGORIES.map(c => (
          <button
            type="button"
            key={c.value}
            className={`category-tab ${category === c.value ? 'active' : ''}`}
            onClick={() => handleCategoryChange(c.value)}
            disabled={loading}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* 二级功能 Tab */}
      <div className="subtype-tabs">
        {subTypes.map((st, i) => (
          <button
            type="button"
            key={st.type}
            className={`subtype-tab ${subTypeIndex === i ? 'active' : ''}`}
            onClick={() => handleSubTypeChange(i)}
            disabled={loading}
          >
            {st.label}
          </button>
        ))}
      </div>

      {/* 三级模型下拉 */}
      <label className="form-label">
        模型
        <select value={modelIndex} onChange={e => setModelIndex(Number(e.target.value))} disabled={loading}>
          {models.map((m, i) => <option key={m.value} value={i}>{m.label}</option>)}
        </select>
      </label>

      {/* 渲染对应的表单 */}
      {formType === 't2v' && <HappyHorseT2vForm key={formKey} model={currentModel.value} loading={loading} onSubmit={onSubmit} initialData={initialData} />}
      {formType === 'i2v' && <HappyHorseI2vForm key={formKey} model={currentModel.value} loading={loading} onSubmit={onSubmit} initialData={initialData} />}
      {formType === 'wan27-i2v' && <Wan27I2vForm key={formKey} model={currentModel.value} loading={loading} onSubmit={onSubmit} initialData={initialData} />}
      {formType === 'r2v' && <HappyHorseR2vForm key={formKey} model={currentModel.value} loading={loading} onSubmit={onSubmit} initialData={initialData} />}
      {formType === 'edit' && <HappyHorseEditForm key={formKey} model={currentModel.value} loading={loading} onSubmit={onSubmit} initialData={initialData} />}
      {formType === 't2i' && <QwenImageForm key={formKey} model={currentModel.value} loading={loading} onSubmit={onSubmit} initialData={initialData} />}
      {formType === 'i2i' && <QwenImageEditForm key={formKey} model={currentModel.value} loading={loading} onSubmit={onSubmit} initialData={initialData} />}
    </form>
  )
}
