import type { PromptEditorHandle } from '../shared/PromptEditor'
import type { GenerateFormData, ModelFormProps } from '../types'
import { useCallback, useRef, useState } from 'react'
import { fileToBase64 } from '../../../utils/fileToBase64'
import { DURATIONS, R2V_MAX_IMAGES, RATIOS, RESOLUTIONS } from '../constants'
import { AdvancedOptions } from '../shared/AdvancedOptions'
import { MultiImageInput } from '../shared/MultiImageInput'
import { PromptEditor } from '../shared/PromptEditor'

export function HappyHorseR2vForm({ model, loading, onSubmit, initialData }: ModelFormProps) {
  const [prompt, setPrompt] = useState(initialData?.prompt ?? '')
  const [imageUrls, setImageUrls] = useState<string[]>([])
  const [resolution, setResolution] = useState(initialData?.resolution ?? '1080P')
  const [ratio, setRatio] = useState(initialData?.ratio ?? '16:9')
  const [duration, setDuration] = useState(initialData?.duration ?? 5)
  const [watermark, setWatermark] = useState(true)
  const [seed, setSeed] = useState<number | undefined>(undefined)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const urlInputRef = useRef<HTMLInputElement>(null)
  const editorRef = useRef<PromptEditorHandle>(null)

  const canSubmit = prompt.trim() && !loading && imageUrls.length > 0

  const handleFileAdd = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files)
      return
    const newUrls: string[] = []
    for (const file of Array.from(files)) {
      if (newUrls.length + imageUrls.length >= R2V_MAX_IMAGES)
        break
      newUrls.push(await fileToBase64(file))
    }
    setImageUrls(prev => [...prev, ...newUrls].slice(0, R2V_MAX_IMAGES))
    if (fileInputRef.current)
      fileInputRef.current.value = ''
  }, [imageUrls.length])

  const handleUrlAdd = useCallback((val: string) => {
    if (val)
      setImageUrls(prev => [...prev, val].slice(0, R2V_MAX_IMAGES))
  }, [])

  const removeImage = useCallback((index: number) => {
    setImageUrls(prev => prev.filter((_, i) => i !== index))
  }, [])

  /** Flush any URL the user typed but didn't press Enter for */
  const flushUrlInput = useCallback((): string[] => {
    if (!urlInputRef.current)
      return imageUrls
    const val = urlInputRef.current.value.trim()
    if (!val)
      return imageUrls
    const merged = [...imageUrls, val].slice(0, R2V_MAX_IMAGES)
    setImageUrls(merged)
    urlInputRef.current.value = ''
    return merged
  }, [imageUrls])

  const handleInsertImageRef = useCallback((imageIndex: number) => {
    const cleaned = prompt.replace(/@$/, '')
    const newPrompt = `${cleaned}[Image ${imageIndex}]`
    setPrompt(newPrompt)
    // Use latest imageUrls via ref pattern
    editorRef.current?.setContent(newPrompt, imageUrls)
  }, [prompt, imageUrls])

  const handleSubmit = useCallback(() => {
    if (!canSubmit)
      return
    const finalImageUrls = flushUrlInput()
    const data: GenerateFormData = {
      prompt: prompt.trim(),
      model,
      imageUrls: finalImageUrls,
      resolution,
      ratio,
      duration,
      watermark,
      ...(seed !== undefined && { seed }),
    }
    onSubmit(data)
    setPrompt('')
    setImageUrls([])
    if (fileInputRef.current)
      fileInputRef.current.value = ''
    editorRef.current?.setContent('', [])
  }, [canSubmit, prompt, model, resolution, ratio, duration, watermark, seed, onSubmit, flushUrlInput])

  return (
    <>
      <MultiImageInput
        imageUrls={imageUrls}
        maxImages={R2V_MAX_IMAGES}
        onFileAdd={handleFileAdd}
        onUrlAdd={handleUrlAdd}
        onRemove={removeImage}
        fileInputRef={fileInputRef}
        urlInputRef={urlInputRef}
        disabled={loading}
      />

      <PromptEditor
        ref={editorRef}
        value={prompt}
        imageUrls={imageUrls}
        onChange={setPrompt}
        onInsertImageRef={handleInsertImageRef}
        placeholder="描述视频内容，输入 @ 引用参考图..."
        disabled={loading}
        showMentions
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
