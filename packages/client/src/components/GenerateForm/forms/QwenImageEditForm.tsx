import { useCallback, useMemo, useRef, useState } from 'react'
import { IMAGE_SIZES_V2 } from '../constants'
import type { GenerateFormData, ModelFormProps } from '../types'
import { PromptEditor } from '../shared/PromptEditor'
import type { PromptEditorHandle } from '../shared/PromptEditor'
import { MultiImageInput } from '../shared/MultiImageInput'
import { fileToBase64 } from '../../../utils/fileToBase64'

const MAX_IMAGES = 3

/** qwen-image-edit 不支持 size / n / prompt_extend */
function isLimitedModel(model: string): boolean {
  return model === 'qwen-image-edit'
}

export function QwenImageEditForm({ model, loading, onSubmit }: ModelFormProps) {
  const [imageUrls, setImageUrls] = useState<string[]>([])
  const [prompt, setPrompt] = useState('')
  const [size, setSize] = useState('2048*2048')
  const [negativePrompt, setNegativePrompt] = useState('')
  const [n, setN] = useState(1)
  const [promptExtend, setPromptExtend] = useState(true)
  const [watermark, setWatermark] = useState(false)
  const [seed, setSeed] = useState<number | undefined>(undefined)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const urlInputRef = useRef<HTMLInputElement>(null)
  const editorRef = useRef<PromptEditorHandle>(null)

  const limited = useMemo(() => isLimitedModel(model), [model])

  const canSubmit = prompt.trim() && !loading && imageUrls.length > 0

  const handleFileAdd = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files)
      return
    for (const file of Array.from(files)) {
      if (imageUrls.length >= MAX_IMAGES)
        break
      const base64 = await fileToBase64(file)
      setImageUrls(prev => [...prev, base64])
    }
    if (fileInputRef.current)
      fileInputRef.current.value = ''
  }, [imageUrls.length])

  const handleUrlAdd = useCallback((url: string) => {
    setImageUrls(prev => prev.length < MAX_IMAGES ? [...prev, url] : prev)
  }, [])

  const handleRemove = useCallback((index: number) => {
    setImageUrls(prev => prev.filter((_, i) => i !== index))
  }, [])

  const handleSubmit = useCallback(() => {
    if (!canSubmit)
      return
    const data: GenerateFormData = limited
      ? {
          prompt: prompt.trim(),
          model,
          imageUrls,
          resolution: '',
          n: 1,
          negativePrompt: negativePrompt.trim() || undefined,
          watermark,
          ...(seed !== undefined && { seed }),
        }
      : {
          prompt: prompt.trim(),
          model,
          imageUrls,
          resolution: size,
          size,
          n,
          negativePrompt: negativePrompt.trim() || undefined,
          promptExtend,
          watermark,
          ...(seed !== undefined && { seed }),
        }
    onSubmit(data)
    setPrompt('')
    setImageUrls([])
    setNegativePrompt('')
    editorRef.current?.setContent('', [])
  }, [canSubmit, prompt, model, imageUrls, size, n, limited, negativePrompt, promptExtend, watermark, seed, onSubmit])

  return (
    <>
      <label className="form-label">
        输入图片（1-3 张）
      </label>
      <MultiImageInput
        imageUrls={imageUrls}
        maxImages={MAX_IMAGES}
        onFileAdd={handleFileAdd}
        onUrlAdd={handleUrlAdd}
        onRemove={handleRemove}
        fileInputRef={fileInputRef}
        urlInputRef={urlInputRef}
        disabled={loading}
      />

      <PromptEditor
        ref={editorRef}
        value={prompt}
        imageUrls={[]}
        onChange={setPrompt}
        onInsertImageRef={() => {}}
        placeholder="描述期望的编辑效果..."
        disabled={loading}
        showMentions={false}
      />

      {!limited && (
        <>
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

          <div className="form-options">
            <label>
              分辨率
              <select value={size} onChange={e => setSize(e.target.value)} disabled={loading}>
                {IMAGE_SIZES_V2.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </label>
            <label>
              生成数量
              <select value={n} onChange={e => setN(Number(e.target.value))} disabled={loading}>
                {[1, 2, 3, 4, 5, 6].map(v => <option key={v} value={v}>{`${v} 张`}</option>)}
              </select>
            </label>
          </div>

          <label className="form-label">
            <input
              type="checkbox"
              checked={promptExtend}
              onChange={e => setPromptExtend(e.target.checked)}
              disabled={loading}
            />
            Prompt 智能改写
          </label>
        </>
      )}

      <div className="form-options">
        <label>
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

      <button type="button" disabled={!canSubmit} onClick={handleSubmit}>
        {loading ? '生成中...' : '生成图片'}
      </button>
    </>
  )
}
