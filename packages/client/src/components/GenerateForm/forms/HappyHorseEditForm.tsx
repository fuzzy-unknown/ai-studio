import { useCallback, useRef, useState } from 'react'
import { DURATIONS, EDIT_MAX_IMAGES, RESOLUTIONS } from '../constants'
import type { GenerateFormData, ModelFormProps } from '../types'
import { AdvancedOptions } from '../shared/AdvancedOptions'
import { MultiImageInput } from '../shared/MultiImageInput'
import { PromptEditor } from '../shared/PromptEditor'
import type { PromptEditorHandle } from '../shared/PromptEditor'

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export function HappyHorseEditForm({ model, loading, onSubmit }: ModelFormProps) {
  const [prompt, setPrompt] = useState('')
  const [videoUrl, setVideoUrl] = useState('')
  const [imageUrls, setImageUrls] = useState<string[]>([])
  const [resolution, setResolution] = useState('1080P')
  const [watermark, setWatermark] = useState(true)
  const [audioSetting, setAudioSetting] = useState('auto')
  const [seed, setSeed] = useState<number | undefined>(undefined)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const urlInputRef = useRef<HTMLInputElement>(null)
  const editorRef = useRef<PromptEditorHandle>(null)

  const canSubmit = prompt.trim() && !loading && !!videoUrl

  const handleFileAdd = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files)
      return
    const newUrls: string[] = []
    for (const file of Array.from(files)) {
      if (newUrls.length + imageUrls.length >= EDIT_MAX_IMAGES)
        break
      newUrls.push(await fileToBase64(file))
    }
    setImageUrls(prev => [...prev, ...newUrls].slice(0, EDIT_MAX_IMAGES))
    if (fileInputRef.current)
      fileInputRef.current.value = ''
  }, [imageUrls.length])

  const handleUrlAdd = useCallback((val: string) => {
    if (val)
      setImageUrls(prev => [...prev, val].slice(0, EDIT_MAX_IMAGES))
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
    const merged = [...imageUrls, val].slice(0, EDIT_MAX_IMAGES)
    setImageUrls(merged)
    urlInputRef.current.value = ''
    return merged
  }, [imageUrls])

  const handleInsertImageRef = useCallback((imageIndex: number) => {
    const cleaned = prompt.replace(/@$/, '')
    const newPrompt = `${cleaned}[Image ${imageIndex}]`
    setPrompt(newPrompt)
    editorRef.current?.setContent(newPrompt, imageUrls)
  }, [prompt, imageUrls])

  const handleSubmit = useCallback(() => {
    if (!canSubmit)
      return
    const finalImageUrls = flushUrlInput()
    const data: GenerateFormData = {
      prompt: prompt.trim(),
      model,
      videoUrl,
      resolution,
      watermark,
      ...(finalImageUrls.length > 0 && { imageUrls: finalImageUrls }),
      ...(audioSetting !== 'auto' && { audioSetting }),
      ...(seed !== undefined && { seed }),
    }
    onSubmit(data)
    setPrompt('')
    setVideoUrl('')
    setImageUrls([])
    if (fileInputRef.current)
      fileInputRef.current.value = ''
    editorRef.current?.setContent('', [])
  }, [canSubmit, prompt, model, videoUrl, resolution, watermark, audioSetting, seed, onSubmit, flushUrlInput])

  return (
    <>
      <div className="image-input">
        <label className="form-label">
          输入视频 URL
          <input
            type="text"
            placeholder="粘贴待编辑视频的公网 URL..."
            value={videoUrl}
            onChange={e => setVideoUrl(e.target.value)}
            disabled={loading}
            className="video-url-input"
          />
        </label>
      </div>

      <MultiImageInput
        imageUrls={imageUrls}
        maxImages={EDIT_MAX_IMAGES}
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
        placeholder="描述编辑意图，输入 @ 引用参考图..."
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
      </div>

      <AdvancedOptions
        watermark={watermark}
        onWatermarkChange={setWatermark}
        seed={seed}
        onSeedChange={setSeed}
        audioSetting={audioSetting}
        onAudioSettingChange={setAudioSetting}
        disabled={loading}
      />

      <button type="button" disabled={!canSubmit} onClick={handleSubmit}>
        {loading ? '生成中...' : '生成视频'}
      </button>
    </>
  )
}
