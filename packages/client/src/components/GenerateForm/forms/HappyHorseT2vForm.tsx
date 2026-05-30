import type { PromptEditorHandle } from '../shared/PromptEditor'
import type { GenerateFormData, ModelFormProps } from '../types'
import { useCallback, useRef, useState } from 'react'
import { DURATIONS, RATIOS, RESOLUTIONS } from '../constants'
import { AdvancedOptions } from '../shared/AdvancedOptions'
import { PromptEditor } from '../shared/PromptEditor'

export function HappyHorseT2vForm({ model, loading, onSubmit, initialData }: ModelFormProps) {
  const [prompt, setPrompt] = useState(initialData?.prompt ?? '')
  const [resolution, setResolution] = useState(initialData?.resolution ?? '720P')
  const [ratio, setRatio] = useState(initialData?.ratio ?? '16:9')
  const [duration, setDuration] = useState(initialData?.duration ?? 5)
  const [watermark, setWatermark] = useState(true)
  const [seed, setSeed] = useState<number | undefined>(undefined)

  const editorRef = useRef<PromptEditorHandle>(null)

  const canSubmit = prompt.trim() && !loading

  const handleSubmit = useCallback(() => {
    if (!canSubmit)
      return
    const data: GenerateFormData = {
      prompt: prompt.trim(),
      model,
      resolution,
      ratio,
      duration,
      watermark,
      ...(seed !== undefined && { seed }),
    }
    onSubmit(data)
    setPrompt('')
    editorRef.current?.setContent('', [])
  }, [canSubmit, prompt, model, resolution, ratio, duration, watermark, seed, onSubmit])

  return (
    <>
      <PromptEditor
        ref={editorRef}
        value={prompt}
        imageUrls={[]}
        onChange={setPrompt}
        onInsertImageRef={() => {}}
        placeholder="描述你想要生成的视频内容..."
        disabled={loading}
        showMentions={false}
      />

      <div className="form-options">
        <label>
          分辨率
          <select value={resolution} onChange={e => setResolution(e.target.value)} disabled={loading}>
            {RESOLUTIONS.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </label>
        <label>
          宽高比
          <select value={ratio} onChange={e => setRatio(e.target.value)} disabled={loading}>
            {RATIOS.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </label>
        <label>
          时长
          <select value={duration} onChange={e => setDuration(Number(e.target.value))} disabled={loading}>
            {DURATIONS.map(d => <option key={d} value={d}>{`${d}s`}</option>)}
          </select>
        </label>
      </div>

      <AdvancedOptions
        watermark={watermark}
        onWatermarkChange={setWatermark}
        seed={seed}
        onSeedChange={setSeed}
        disabled={loading}
      />

      <button type="button" disabled={!canSubmit} onClick={handleSubmit}>
        {loading ? '生成中...' : '生成视频'}
      </button>
    </>
  )
}
