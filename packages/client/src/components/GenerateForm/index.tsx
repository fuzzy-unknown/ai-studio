import { useState } from 'react'
import { MODELS } from './constants'
import type { GenerateFormData } from './types'
import { HappyHorseEditForm } from './forms/HappyHorseEditForm'
import { HappyHorseI2vForm } from './forms/HappyHorseI2vForm'
import { HappyHorseR2vForm } from './forms/HappyHorseR2vForm'
import { HappyHorseT2vForm } from './forms/HappyHorseT2vForm'
import { QwenImageForm } from './forms/QwenImageForm'

interface Props {
  onSubmit: (data: GenerateFormData) => void
  loading: boolean
}

export function GenerateForm({ onSubmit, loading }: Props) {
  const [model, setModel] = useState(MODELS[0].value)
  const currentModel = MODELS.find(m => m.value === model)!
  const type = currentModel.type

  return (
    <form className="generate-form" onSubmit={e => e.preventDefault()}>
      <label className="form-label">
        模型
        <select value={model} onChange={e => setModel(e.target.value)} disabled={loading}>
          {MODELS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
      </label>

      {type === 't2v' && <HappyHorseT2vForm key={model} model={model} loading={loading} onSubmit={onSubmit} />}
      {type === 'i2v' && <HappyHorseI2vForm key={model} model={model} loading={loading} onSubmit={onSubmit} />}
      {type === 'r2v' && <HappyHorseR2vForm key={model} model={model} loading={loading} onSubmit={onSubmit} />}
      {type === 'edit' && <HappyHorseEditForm key={model} model={model} loading={loading} onSubmit={onSubmit} />}
      {type === 't2i' && <QwenImageForm key={model} model={model} loading={loading} onSubmit={onSubmit} />}
    </form>
  )
}
