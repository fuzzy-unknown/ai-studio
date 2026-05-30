import { useCallback, useMemo, useRef, useState } from 'react'
import {
  IMAGE_MODELS,
  IMAGE_SIZES_LEGACY,
  IMAGE_SIZES_V2,
} from '../constants'
import type { GenerateFormData, ModelFormProps } from '../types'
import { PromptEditor } from '../shared/PromptEditor'
import type { PromptEditorHandle } from '../shared/PromptEditor'

/** 判断是否为 2.0 系列模型 */
function isV2Model(model: string): boolean {
  return model.startsWith('qwen-image-2.0')
}

export function QwenImageForm({ model: initialModel, loading, onSubmit }: ModelFormProps) {
  const [subModel, setSubModel] = useState(initialModel)
  const [prompt, setPrompt] = useState('')
  const [size, setSize] = useState(isV2Model(initialModel) ? '2048*2048' : '1664*928')
  const [n, setN] = useState(1)
  const [negativePrompt, setNegativePrompt] = useState('')
  const [promptExtend, setPromptExtend] = useState(true)
  const [watermark, setWatermark] = useState(false)
  const [seed, setSeed] = useState<number | undefined>(undefined)
  const [showAdvanced, setShowAdvanced] = useState(false)

  const editorRef = useRef<PromptEditorHandle>(null)

  const sizes = useMemo(
    () => isV2Model(subModel) ? IMAGE_SIZES_V2 : IMAGE_SIZES_LEGACY,
    [subModel],
  )

  const showN = isV2Model(subModel)

  const canSubmit = prompt.trim() && !loading

  const handleSubModelChange = useCallback((newModel: string) => {
    setSubModel(newModel)
    // 切换系列时重置 size
    if (isV2Model(newModel))
      setSize('2048*2048')
    else
      setSize('1664*928')
    if (!isV2Model(newModel))
      setN(1)
  }, [])

  const handleSubmit = useCallback(() => {
    if (!canSubmit)
      return
    const data: GenerateFormData = {
      prompt: prompt.trim(),
      model: subModel,
      resolution: size,
      size,
      n: showN ? n : 1,
      negativePrompt: negativePrompt || undefined,
      promptExtend,
      watermark,
      ...(seed !== undefined && { seed }),
    }
    onSubmit(data)
    setPrompt('')
    editorRef.current?.setContent('', [])
  }, [canSubmit, prompt, subModel, size, n, showN, negativePrompt, promptExtend, watermark, seed, onSubmit])

  return (
    <>
      <label className="form-label">
        子模型
        <select value={subModel} onChange={e => handleSubModelChange(e.target.value)} disabled={loading}>
          {IMAGE_MODELS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
      </label>

      <PromptEditor
        ref={editorRef}
        value={prompt}
        imageUrls={[]}
        onChange={setPrompt}
        onInsertImageRef={() => {}}
        placeholder="描述你想要生成的图片内容..."
        disabled={loading}
        showMentions={false}
      />

      <div className="form-options">
        <label>
          分辨率
          <select value={size} onChange={e => setSize(e.target.value)} disabled={loading}>
            {sizes.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </label>
        {showN && (
          <label>
            数量
            <select value={n} onChange={e => setN(Number(e.target.value))} disabled={loading}>
              {[1, 2, 3, 4, 5, 6].map(i => <option key={i} value={i}>{`${i} 张`}</option>)}
            </select>
          </label>
        )}
      </div>

      <div className="advanced-section">
        <button
          type="button"
          className="advanced-toggle"
          onClick={() => setShowAdvanced(prev => !prev)}
        >
          高级选项
          {' '}
          {showAdvanced ? '▼' : '▶'}
        </button>
        {showAdvanced && (
          <div className="advanced-options">
            <label className="form-label">
              反向提示词
              <input
                type="text"
                placeholder="描述不希望出现的内容..."
                value={negativePrompt}
                onChange={e => setNegativePrompt(e.target.value)}
                disabled={loading}
                className="seed-input"
              />
            </label>
            <label className="form-label">
              <input
                type="checkbox"
                checked={promptExtend}
                onChange={e => setPromptExtend(e.target.checked)}
                disabled={loading}
              />
              智能改写提示词
            </label>
            <label className="form-label">
              <input
                type="checkbox"
                checked={watermark}
                onChange={e => setWatermark(e.target.checked)}
                disabled={loading}
              />
              添加水印
            </label>
            <label className="form-label">
              随机种子
              <input
                type="number"
                min={0}
                max={2147483647}
                placeholder="留空则随机"
                value={seed ?? ''}
                onChange={e => setSeed(e.target.value ? Number(e.target.value) : undefined)}
                disabled={loading}
                className="seed-input"
              />
            </label>
          </div>
        )}
      </div>

      <button type="button" disabled={!canSubmit} onClick={handleSubmit}>
        {loading ? '生成中...' : '生成图片'}
      </button>
    </>
  )
}
