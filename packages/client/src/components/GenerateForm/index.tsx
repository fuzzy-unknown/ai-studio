import { useCallback, useMemo, useState } from 'react'
import { CATEGORIES, MODEL_GROUPS } from './constants'
import type { Category } from './constants'
import type { GenerateFormData } from './types'
import { HappyHorseEditForm } from './forms/HappyHorseEditForm'
import { HappyHorseI2vForm } from './forms/HappyHorseI2vForm'
import { HappyHorseR2vForm } from './forms/HappyHorseR2vForm'
import { HappyHorseT2vForm } from './forms/HappyHorseT2vForm'
import { Wan27I2vForm } from './forms/Wan27I2vForm'
import { QwenImageForm } from './forms/QwenImageForm'

interface Props {
  onSubmit: (data: GenerateFormData) => void
  loading: boolean
}

export function GenerateForm({ onSubmit, loading }: Props) {
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
      {formType === 't2v' && <HappyHorseT2vForm key={currentModel.value} model={currentModel.value} loading={loading} onSubmit={onSubmit} />}
      {formType === 'i2v' && <HappyHorseI2vForm key={currentModel.value} model={currentModel.value} loading={loading} onSubmit={onSubmit} />}
      {formType === 'wan27-i2v' && <Wan27I2vForm key={currentModel.value} model={currentModel.value} loading={loading} onSubmit={onSubmit} />}
      {formType === 'r2v' && <HappyHorseR2vForm key={currentModel.value} model={currentModel.value} loading={loading} onSubmit={onSubmit} />}
      {formType === 'edit' && <HappyHorseEditForm key={currentModel.value} model={currentModel.value} loading={loading} onSubmit={onSubmit} />}
      {formType === 't2i' && <QwenImageForm key={currentModel.value} model={currentModel.value} loading={loading} onSubmit={onSubmit} />}
    </form>
  )
}
