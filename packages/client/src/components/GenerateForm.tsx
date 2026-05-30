import { useCallback, useEffect, useRef, useState } from 'react'

interface Props {
  onSubmit: (data: {
    prompt: string
    model: string
    imageUrl?: string
    imageUrls?: string[]
    videoUrl?: string
    resolution: string
    ratio?: string
    duration?: number
    watermark?: boolean
    audioSetting?: string
    seed?: number
  }) => void
  loading: boolean
}

const MODELS = [
  { value: 'happyhorse-1.0-t2v', label: 'HappyHorse 文生视频', type: 't2v' as const },
  { value: 'happyhorse-1.0-i2v', label: 'HappyHorse 图生视频（首帧）', type: 'i2v' as const },
  { value: 'happyhorse-1.0-r2v', label: 'HappyHorse 参考生视频', type: 'r2v' as const },
  { value: 'happyhorse-1.0-video-edit', label: 'HappyHorse 视频编辑', type: 'edit' as const },
]

const RATIOS = ['16:9', '9:16', '1:1', '4:3', '3:4', '4:5', '5:4', '9:21', '21:9']
const RESOLUTIONS = ['720P', '1080P']
const DURATIONS = [3, 5, 8, 10, 15]

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

/** Convert prompt string to HTML — [Image N] → inline thumbnail spans */
function promptToHtml(p: string, imageUrls: string[]): string {
  return p.replace(/\[Image (\d+)\]/g, (_, n) => {
    const idx = Number(n) - 1
    const url = imageUrls[idx] || ''
    return `<span class="img-ref" data-img="${n}" contenteditable="false"><img src="${url}" class="img-ref-thumb" /><sup>${n}</sup></span>`
  })
}

/** Extract prompt string from contentEditable DOM */
function domToPrompt(div: HTMLDivElement): string {
  let result = ''
  div.childNodes.forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      result += node.textContent || ''
    }
    else if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement
      if (el.classList.contains('img-ref')) {
        result += `[Image ${el.dataset.img}]`
      }
      else {
        result += domToPrompt(el as HTMLDivElement)
      }
    }
  })
  return result
}

/** Place cursor at end of contentEditable div */
function placeCursorAtEnd(div: HTMLDivElement) {
  div.focus()
  const range = document.createRange()
  range.selectNodeContents(div)
  range.collapse(false)
  const sel = window.getSelection()
  sel?.removeAllRanges()
  sel?.addRange(range)
}

/** Strip HTML from paste, keep plain text only */
function getPasteText(e: React.ClipboardEvent): string {
  if (e.clipboardData.getData('text/plain'))
    return e.clipboardData.getData('text/plain')
  const html = e.clipboardData.getData('text/html')
  if (html) {
    const tmp = document.createElement('div')
    tmp.innerHTML = html
    return tmp.textContent || ''
  }
  return ''
}

const EDIT_MAX_IMAGES = 5

export function GenerateForm({ onSubmit, loading }: Props) {
  const [model, setModel] = useState(MODELS[0].value)
  const [prompt, setPrompt] = useState('')
  const [resolution, setResolution] = useState('720P')
  const [ratio, setRatio] = useState('16:9')
  const [duration, setDuration] = useState(5)
  // i2v: single image
  const [imageUrl, setImageUrl] = useState('')
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  // r2v / edit: multiple images
  const [imageUrls, setImageUrls] = useState<string[]>([])
  const r2vFileInputRef = useRef<HTMLInputElement>(null)
  const imageUrlInputRef = useRef<HTMLInputElement>(null)
  // video edit
  const [videoUrl, setVideoUrl] = useState('')
  const [watermark, setWatermark] = useState(true)
  const [audioSetting, setAudioSetting] = useState('auto')
  const [seed, setSeed] = useState<number | undefined>(undefined)
  const [showAdvanced, setShowAdvanced] = useState(false)
  // contentEditable editor — managed via ref, React never touches innerHTML
  const editorRef = useRef<HTMLDivElement>(null)
  // @ mention dropdown
  const [mentionOpen, setMentionOpen] = useState(false)

  const currentModel = MODELS.find(m => m.value === model)!
  const isI2v = currentModel.type === 'i2v'
  const isR2v = currentModel.type === 'r2v'
  const isEdit = currentModel.type === 'edit'
  const maxImages = isEdit ? EDIT_MAX_IMAGES : 9

  /** Set editor innerHTML programmatically + update prompt state */
  const setEditorContent = useCallback((newPrompt: string, newImageUrls?: string[]) => {
    const urls = newImageUrls ?? imageUrls
    setPrompt(newPrompt)
    const div = editorRef.current
    if (!div)
      return
    const html = promptToHtml(newPrompt, urls)
    div.innerHTML = html
    if (newPrompt.length > 0)
      placeCursorAtEnd(div)
  }, [imageUrls])

  // Re-render thumbnails when imageUrls change (refs may have stale URLs)
  useEffect(() => {
    if (prompt.includes('[Image ') && editorRef.current) {
      editorRef.current.innerHTML = promptToHtml(prompt, imageUrls)
      placeCursorAtEnd(editorRef.current)
    }
  }, [imageUrls])

  const handleModelChange = useCallback((newModel: string) => {
    setModel(newModel)
    const m = MODELS.find(x => x.value === newModel)!
    if (m.type === 'i2v' || m.type === 'r2v' || m.type === 'edit')
      setResolution('1080P')
    else
      setResolution('720P')
    setImageUrl('')
    setImagePreview(null)
    setImageUrls([])
    setVideoUrl('')
    setWatermark(true)
    setAudioSetting('auto')
    setSeed(undefined)
    setShowAdvanced(false)
    setEditorContent('')
  }, [setEditorContent])

  // i2v handlers
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

  // r2v / edit: shared image list handlers
  const handleImageFileAdd = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files)
      return
    const newUrls: string[] = []
    for (const file of Array.from(files)) {
      if (imageUrls.length + newUrls.length >= maxImages)
        break
      newUrls.push(await fileToBase64(file))
    }
    setImageUrls(prev => [...prev, ...newUrls].slice(0, maxImages))
    if (r2vFileInputRef.current)
      r2vFileInputRef.current.value = ''
  }, [imageUrls.length, maxImages])

  const removeImage = useCallback((index: number) => {
    setImageUrls(prev => prev.filter((_, i) => i !== index))
  }, [])

  const handleImageUrlAdd = useCallback((val: string) => {
    if (val && imageUrls.length < maxImages)
      setImageUrls(prev => [...prev, val].slice(0, maxImages))
  }, [imageUrls.length, maxImages])

  // @ mention: insert inline image reference
  const insertImageRef = useCallback((imageIndex: number) => {
    const cleaned = prompt.replace(/@$/, '')
    setEditorContent(`${cleaned}[Image ${imageIndex}]`)
    setMentionOpen(false)
  }, [prompt, setEditorContent])

  // Editor input handler — only reads DOM, never writes innerHTML
  const handleEditorInput = useCallback(() => {
    if (!editorRef.current)
      return
    const newPrompt = domToPrompt(editorRef.current)
    setPrompt(newPrompt)
    if ((isR2v || isEdit) && imageUrls.length > 0 && newPrompt.endsWith('@'))
      setMentionOpen(true)
    else
      setMentionOpen(false)
  }, [isR2v, isEdit, imageUrls.length])

  // Handle paste: insert plain text only to avoid HTML artifacts
  const handleEditorPaste = useCallback((e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault()
    const text = getPasteText(e)
    document.execCommand('insertText', false, text)
  }, [])

  // Close mention dropdown on outside click
  useEffect(() => {
    if (!mentionOpen)
      return
    const handler = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('.mention-dropdown, .prompt-wrapper'))
        setMentionOpen(false)
    }
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [mentionOpen])

  const handleEditorKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (mentionOpen && e.key === 'Escape') {
      setMentionOpen(false)
      e.preventDefault()
    }
  }, [mentionOpen])

  /** Flush any leftover URL from the ref-image input into imageUrls state */
  const flushImageUrlInput = useCallback(() => {
    if (!imageUrlInputRef.current)
      return []
    const val = imageUrlInputRef.current.value.trim()
    if (!val)
      return imageUrls
    const merged = [...imageUrls, val].slice(0, maxImages)
    setImageUrls(merged)
    imageUrlInputRef.current.value = ''
    return merged
  }, [imageUrls, maxImages])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!prompt.trim() || loading)
      return
    // Flush any URL the user typed but didn't press Enter for
    const finalImageUrls = flushImageUrlInput()
    if (isI2v && !imageUrl)
      return
    if (isR2v && finalImageUrls.length === 0)
      return
    if (isEdit && !videoUrl)
      return

    const data: any = { prompt: prompt.trim(), model, resolution }
    if (isI2v) {
      data.imageUrl = imageUrl
      data.duration = duration
    }
    else if (isR2v) {
      data.imageUrls = finalImageUrls
      data.ratio = ratio
      data.duration = duration
    }
    else if (isEdit) {
      data.videoUrl = videoUrl
      if (finalImageUrls.length > 0)
        data.imageUrls = finalImageUrls
      if (audioSetting !== 'auto')
        data.audioSetting = audioSetting
    }
    else {
      data.ratio = ratio
      data.duration = duration
    }

    // watermark 和 seed 所有模型都支持
    data.watermark = watermark
    if (seed !== undefined)
      data.seed = seed

    onSubmit(data)
    setEditorContent('')
  }

  const canSubmit = prompt.trim() && !loading
    && (!isI2v || imageUrl)
    && (!isR2v || imageUrls.length > 0)
    && (!isEdit || videoUrl)

  const placeholder = isI2v
    ? '描述视频内容（可选，用于引导生成）...'
    : isR2v
      ? '描述视频内容，输入 @ 引用参考图...'
      : isEdit
        ? '描述编辑意图，输入 @ 引用参考图...'
        : '描述你想要生成的视频内容...'

  return (
    <form className="generate-form" onSubmit={handleSubmit}>
      <label className="form-label">
        模型
        <select value={model} onChange={e => handleModelChange(e.target.value)} disabled={loading}>
          {MODELS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
      </label>

      {isI2v && (
        <div className="image-input">
          <div className="image-tabs">
            <input
              type="text"
              placeholder="粘贴首帧图片 URL..."
              value={imageUrl.startsWith('data:') ? '' : imageUrl}
              onChange={e => handleUrlChange(e.target.value)}
              disabled={loading}
              className="image-url-input"
            />
            <span className="image-or">或</span>
            <label className="image-upload-btn">
              上传图片
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleFileChange}
                disabled={loading}
              />
            </label>
          </div>
          {imagePreview && (
            <div className="image-preview">
              <img src={imagePreview} alt="首帧图片" />
              <button type="button" className="image-clear" onClick={clearImage}>×</button>
            </div>
          )}
        </div>
      )}

      {isEdit && (
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
      )}

      {(isR2v || isEdit) && (
        <div className="image-input">
          <div className="image-tabs">
            <input
              type="text"
              placeholder="粘贴参考图 URL 后回车添加..."
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleImageUrlAdd((e.target as HTMLInputElement).value.trim())
                  ;(e.target as HTMLInputElement).value = ''
                }
              }}
              disabled={loading}
              className="image-url-input"
            />
            <span className="image-or">
              {imageUrls.length}
              /
              {maxImages}
            </span>
            <label className="image-upload-btn">
              上传图片
              <input
                ref={r2vFileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                onChange={handleImageFileAdd}
                disabled={loading}
              />
            </label>
          </div>
          {imageUrls.length > 0 && (
            <div className="r2v-images">
              {imageUrls.map((url, i) => (
                <div key={url.slice(0, 30) + i} className="r2v-thumb">
                  <img src={url} alt={`参考图 ${i + 1}`} />
                  <span className="r2v-thumb-index">
                    {i + 1}
                  </span>
                  <button type="button" className="image-clear" onClick={() => removeImage(i)}>×</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="prompt-wrapper">
        <div
          ref={editorRef}
          className="prompt-editor"
          contentEditable={!loading}
          suppressContentEditableWarning
          onInput={handleEditorInput}
          onPaste={handleEditorPaste}
          onKeyDown={handleEditorKeyDown}
          data-placeholder={placeholder}
          role="textbox"
          aria-label="prompt"
        />
        {mentionOpen && imageUrls.length > 0 && (
          <div className="mention-dropdown">
            {imageUrls.map((url, i) => (
              <button
                key={url.slice(0, 30) + i}
                type="button"
                className="mention-item"
                onClick={() => insertImageRef(i + 1)}
              >
                <img src={url} alt="" className="mention-thumb" />
                <span>
                  [Image
                  {' '}
                  {i + 1}
                  ]
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="form-options">
        <label>
          分辨率
          <select value={resolution} onChange={e => setResolution(e.target.value)} disabled={loading}>
            {RESOLUTIONS.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </label>
        {!isI2v && !isEdit && (
          <label>
            宽高比
            <select value={ratio} onChange={e => setRatio(e.target.value)} disabled={loading}>
              {RATIOS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </label>
        )}
        {!isEdit && (
          <label>
            时长
            <select value={duration} onChange={e => setDuration(Number(e.target.value))} disabled={loading}>
              {DURATIONS.map(d => <option key={d} value={d}>{`${d}s`}</option>)}
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
              <input
                type="checkbox"
                checked={watermark}
                onChange={e => setWatermark(e.target.checked)}
                disabled={loading}
              />
              添加水印
            </label>
            {isEdit && (
              <label className="form-label">
                声音控制
                <select value={audioSetting} onChange={e => setAudioSetting(e.target.value)} disabled={loading}>
                  <option value="auto">自动</option>
                  <option value="origin">保留原声</option>
                </select>
              </label>
            )}
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

      <button type="submit" disabled={!canSubmit}>
        {loading ? '生成中...' : '生成视频'}
      </button>
    </form>
  )
}
