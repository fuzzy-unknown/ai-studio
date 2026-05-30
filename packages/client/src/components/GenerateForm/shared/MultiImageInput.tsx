import type { RefObject } from 'react'

export interface MultiImageInputProps {
  imageUrls: string[]
  maxImages: number
  onFileAdd: (e: React.ChangeEvent<HTMLInputElement>) => void
  onUrlAdd: (url: string) => void
  onRemove: (index: number) => void
  fileInputRef: RefObject<HTMLInputElement | null>
  urlInputRef: RefObject<HTMLInputElement | null>
  disabled: boolean
}

export function MultiImageInput({
  imageUrls,
  maxImages,
  onFileAdd,
  onUrlAdd,
  onRemove,
  fileInputRef,
  urlInputRef,
  disabled,
}: MultiImageInputProps) {
  return (
    <div className="image-input">
      <div className="image-tabs">
        <input
          ref={urlInputRef}
          type="text"
          placeholder="粘贴参考图 URL 后回车添加..."
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              const val = (e.target as HTMLInputElement).value.trim()
              if (val)
                onUrlAdd(val)
              ;(e.target as HTMLInputElement).value = ''
            }
          }}
          disabled={disabled}
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
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            onChange={onFileAdd}
            disabled={disabled}
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
              <button type="button" className="image-clear" onClick={() => onRemove(i)}>×</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
