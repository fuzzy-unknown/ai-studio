import type { RefObject } from 'react'

export interface SingleImageInputProps {
  imageUrl: string
  imagePreview: string | null
  onUrlChange: (url: string) => void
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  onClear: () => void
  fileInputRef: RefObject<HTMLInputElement | null>
  disabled: boolean
}

export function SingleImageInput({
  imageUrl,
  imagePreview,
  onUrlChange,
  onFileChange,
  onClear,
  fileInputRef,
  disabled,
}: SingleImageInputProps) {
  return (
    <div className="image-input">
      <div className="image-tabs">
        <input
          type="text"
          placeholder="粘贴首帧图片 URL..."
          value={imageUrl.startsWith('data:') ? '' : imageUrl}
          onChange={e => onUrlChange(e.target.value)}
          disabled={disabled}
          className="image-url-input"
        />
        <span className="image-or">或</span>
        <label className="image-upload-btn">
          上传图片
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={onFileChange}
            disabled={disabled}
          />
        </label>
      </div>
      {imagePreview && (
        <div className="image-preview">
          <img src={imagePreview} alt="首帧图片" />
          <button type="button" className="image-clear" onClick={onClear}>×</button>
        </div>
      )}
    </div>
  )
}
