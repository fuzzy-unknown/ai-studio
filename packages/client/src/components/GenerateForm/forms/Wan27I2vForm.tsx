import { useCallback, useRef, useState } from 'react'
import { RESOLUTIONS, WAN27_DURATIONS } from '../constants'
import type { GenerateFormData, ModelFormProps } from '../types'
import { AdvancedOptions } from '../shared/AdvancedOptions'
import { PromptEditor } from '../shared/PromptEditor'
import type { PromptEditorHandle } from '../shared/PromptEditor'
import { SingleImageInput } from '../shared/SingleImageInput'
import { fileToBase64 } from '../../../utils/fileToBase64'

type SubTaskMode = 'first_frame' | 'first_last_frame' | 'video_continuation'

/** 通用 URL + 文件上传输入组件 */
function MediaUrlInput({
  label,
  placeholder,
  value,
  onValueChange,
  accept,
  disabled,
}: {
  label: string
  placeholder: string
  value: string
  onValueChange: (v: string) => void
  accept: string
  disabled: boolean
}) {
  const fileRef = useRef<HTMLInputElement>(null)

  const handleFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file)
      return
    const base64 = await fileToBase64(file)
    onValueChange(base64)
  }, [onValueChange])

  return (
    <label className="form-label">
      {label}
      <div className="image-tabs">
        <input
          type="text"
          placeholder={placeholder}
          value={value.startsWith('data:') ? '' : value}
          onChange={e => onValueChange(e.target.value)}
          disabled={disabled}
          className="image-url-input"
        />
        <span className="image-or">或</span>
        <label className="image-upload-btn">
          上传文件
          <input
            ref={fileRef}
            type="file"
            accept={accept}
            onChange={handleFile}
            disabled={disabled}
          />
        </label>
      </div>
    </label>
  )
}

const SUB_TASK_MODES: { value: SubTaskMode, label: string }[] = [
  { value: 'first_frame', label: '首帧生视频' },
  { value: 'first_last_frame', label: '首尾帧生视频' },
  { value: 'video_continuation', label: '视频续写' },
]

export function Wan27I2vForm({ model, loading, onSubmit }: ModelFormProps) {
  const [mode, setMode] = useState<SubTaskMode>('first_frame')

  // 首帧图片
  const [imageUrl, setImageUrl] = useState('')
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  // 尾帧图片
  const [lastFrameUrl, setLastFrameUrl] = useState('')
  const [lastFramePreview, setLastFramePreview] = useState<string | null>(null)
  // 驱动音频
  const [drivingAudioUrl, setDrivingAudioUrl] = useState('')
  // 首段视频
  const [firstClipUrl, setFirstClipUrl] = useState('')

  const [prompt, setPrompt] = useState('')
  const [negativePrompt, setNegativePrompt] = useState('')
  const [promptExtend, setPromptExtend] = useState(true)
  const [resolution, setResolution] = useState('1080P')
  const [duration, setDuration] = useState(5)
  const [watermark, setWatermark] = useState(false)
  const [seed, setSeed] = useState<number | undefined>(undefined)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const lastFrameFileRef = useRef<HTMLInputElement>(null)
  const editorRef = useRef<PromptEditorHandle>(null)

  // 校验必填字段
  const canSubmit = (() => {
    if (!prompt.trim() || loading)
      return false
    if (mode === 'first_frame')
      return !!imageUrl
    if (mode === 'first_last_frame')
      return !!imageUrl && !!lastFrameUrl
    if (mode === 'video_continuation')
      return !!firstClipUrl
    return false
  })()

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

  const handleLastFrameFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file)
      return
    const base64 = await fileToBase64(file)
    setLastFrameUrl(base64)
    setLastFramePreview(base64)
  }, [])

  const handleLastFrameUrlChange = useCallback((url: string) => {
    setLastFrameUrl(url)
    setLastFramePreview(url || null)
  }, [])

  const clearLastFrame = useCallback(() => {
    setLastFrameUrl('')
    setLastFramePreview(null)
    if (lastFrameFileRef.current)
      lastFrameFileRef.current.value = ''
  }, [])

  const handleSubmit = useCallback(() => {
    if (!canSubmit)
      return
    const data: GenerateFormData = {
      prompt: prompt.trim(),
      model,
      resolution,
      duration,
      watermark,
      negativePrompt: negativePrompt.trim() || undefined,
      promptExtend,
      ...(seed !== undefined && { seed }),
    }
    // 根据模式填充媒体参数
    if (mode === 'first_frame') {
      data.imageUrl = imageUrl
      if (drivingAudioUrl)
        data.drivingAudioUrl = drivingAudioUrl
    }
    else if (mode === 'first_last_frame') {
      data.imageUrl = imageUrl
      data.lastFrameUrl = lastFrameUrl
      if (drivingAudioUrl)
        data.drivingAudioUrl = drivingAudioUrl
    }
    else if (mode === 'video_continuation') {
      data.firstClipUrl = firstClipUrl
      if (lastFrameUrl)
        data.lastFrameUrl = lastFrameUrl
    }
    onSubmit(data)
    // 重置
    setPrompt('')
    setImageUrl('')
    setImagePreview(null)
    setLastFrameUrl('')
    setLastFramePreview(null)
    setDrivingAudioUrl('')
    setFirstClipUrl('')
    editorRef.current?.setContent('', [])
  }, [canSubmit, prompt, model, resolution, duration, watermark, negativePrompt, promptExtend, seed, mode, imageUrl, lastFrameUrl, drivingAudioUrl, firstClipUrl, onSubmit])

  const showFirstFrame = mode === 'first_frame' || mode === 'first_last_frame'
  const showLastFrame = mode === 'first_last_frame' || mode === 'video_continuation'
  const showDrivingAudio = mode === 'first_frame' || mode === 'first_last_frame'
  const showFirstClip = mode === 'video_continuation'

  return (
    <>
      {/* 子任务模式选择 */}
      <div className="subtask-tabs">
        {SUB_TASK_MODES.map(m => (
          <button
            type="button"
            key={m.value}
            className={`subtask-tab ${mode === m.value ? 'active' : ''}`}
            onClick={() => setMode(m.value)}
            disabled={loading}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* 首帧图片 */}
      {showFirstFrame && (
        <>
          <label className="form-label">首帧图片</label>
          <SingleImageInput
            imageUrl={imageUrl}
            imagePreview={imagePreview}
            onUrlChange={handleUrlChange}
            onFileChange={handleFileChange}
            onClear={clearImage}
            fileInputRef={fileInputRef}
            disabled={loading}
          />
        </>
      )}

      {/* 尾帧图片 */}
      {showLastFrame && (
        <>
          <label className="form-label">尾帧图片</label>
          <SingleImageInput
            imageUrl={lastFrameUrl}
            imagePreview={lastFramePreview}
            onUrlChange={handleLastFrameUrlChange}
            onFileChange={handleLastFrameFileChange}
            onClear={clearLastFrame}
            fileInputRef={lastFrameFileRef}
            disabled={loading}
          />
        </>
      )}

      {/* 驱动音频 */}
      {showDrivingAudio && (
        <MediaUrlInput
          label="驱动音频（可选）"
          placeholder="粘贴音频 URL（wav/mp3）..."
          value={drivingAudioUrl}
          onValueChange={setDrivingAudioUrl}
          accept=".wav,.mp3"
          disabled={loading}
        />
      )}

      {/* 首段视频 */}
      {showFirstClip && (
        <MediaUrlInput
          label="首段视频"
          placeholder="粘贴视频 URL（mp4/mov）..."
          value={firstClipUrl}
          onValueChange={setFirstClipUrl}
          accept=".mp4,.mov,video/mp4,video/quicktime"
          disabled={loading}
        />
      )}

      <PromptEditor
        ref={editorRef}
        value={prompt}
        imageUrls={[]}
        onChange={setPrompt}
        onInsertImageRef={() => {}}
        placeholder="描述视频内容..."
        disabled={loading}
        showMentions={false}
      />

      {/* 反向提示词 */}
      <label className="form-label">
        反向提示词（可选）
        <input
          type="text"
          placeholder="描述不希望出现的内容..."
          value={negativePrompt}
          onChange={e => setNegativePrompt(e.target.value)}
          maxLength={500}
          disabled={loading}
          className="seed-input"
        />
      </label>

      {/* Prompt 智能改写 */}
      <label className="form-label">
        <input
          type="checkbox"
          checked={promptExtend}
          onChange={e => setPromptExtend(e.target.checked)}
          disabled={loading}
        />
        Prompt 智能改写
      </label>

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
            {WAN27_DURATIONS.map(d => <option key={d} value={d}>{`${d}s`}</option>)}
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
