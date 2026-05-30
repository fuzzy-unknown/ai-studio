import { useCallback, useRef, useState } from 'react'
import { DURATIONS, RESOLUTIONS } from '../constants'
import type { GenerateFormData, ModelFormProps } from '../types'
import { AdvancedOptions } from '../shared/AdvancedOptions'
import { PromptEditor } from '../shared/PromptEditor'
import type { PromptEditorHandle } from '../shared/PromptEditor'
import { SingleImageInput } from '../shared/SingleImageInput'

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export function HappyHorseI2vForm({ model, loading, onSubmit }: ModelFormProps) {
  const [prompt, setPrompt] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [resolution, setResolution] = useState('1080P')
  const [duration, setDuration] = useState(5)
  const [watermark, setWatermark] = useState(true)
  const [seed, setSeed] = useState<number | undefined>(undefined)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const editorRef = useRef<PromptEditorHandle>(null)

  const canSubmit = prompt.trim() && !loading && !!imageUrl

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file)
      return
    const base64 = await fileToBase64(file)
    setImageUrl(base64)
    setImagePreview(base64)
  }, [])

  const handleUrlChange = useCallback((url: string) => {
    setImageUrl(url)
    setImagePreview(url || null)
  }, [])

  const clearImage = useCallback(() => {
    setImageUrl('')
    setImagePreview(null)
    if (fileInputRef.current)
      fileInputRef.current.value = ''
  }, [])

  const handleSubmit = useCallback(() => {
    if (!canSubmit)
      return
    const data: GenerateFormData = {
      prompt: prompt.trim(),
      model,
      imageUrl,
      resolution,
      duration,
      watermark,
      ...(seed !== undefined && { seed }),
    }
    onSubmit(data)
    setPrompt('')
    setImageUrl('')
    setImagePreview(null)
    if (fileInputRef.current)
      fileInputRef.current.value = ''
    editorRef.current?.setContent('', [])
  }, [canSubmit, prompt, model, imageUrl, resolution, duration, watermark, seed, onSubmit])

  return (
    <>
      <SingleImageInput
        imageUrl={imageUrl}
        imagePreview={imagePreview}
        onUrlChange={handleUrlChange}
        onFileChange={handleFileChange}
        onClear={clearImage}
        fileInputRef={fileInputRef}
        disabled={loading}
      />

      <PromptEditor
        ref={editorRef}
        value={prompt}
        imageUrls={[]}
        onChange={setPrompt}
        onInsertImageRef={() => {}}
        placeholder="描述视频内容（可选，用于引导生成）..."
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
