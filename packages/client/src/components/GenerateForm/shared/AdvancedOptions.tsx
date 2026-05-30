import { useState } from 'react'

export interface AdvancedOptionsProps {
  watermark: boolean
  onWatermarkChange: (v: boolean) => void
  seed: number | undefined
  onSeedChange: (v: number | undefined) => void
  /** 传入则显示音频控制下拉框（仅 edit 模型） */
  audioSetting?: string
  onAudioSettingChange?: (v: string) => void
  disabled: boolean
}

export function AdvancedOptions({
  watermark,
  onWatermarkChange,
  seed,
  onSeedChange,
  audioSetting,
  onAudioSettingChange,
  disabled,
}: AdvancedOptionsProps) {
  const [showAdvanced, setShowAdvanced] = useState(false)

  return (
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
              onChange={e => onWatermarkChange(e.target.checked)}
              disabled={disabled}
            />
            添加水印
          </label>
          {audioSetting !== undefined && onAudioSettingChange && (
            <label className="form-label">
              声音控制
              <select value={audioSetting} onChange={e => onAudioSettingChange(e.target.value)} disabled={disabled}>
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
              onChange={e => onSeedChange(e.target.value ? Number(e.target.value) : undefined)}
              disabled={disabled}
              className="seed-input"
            />
          </label>
        </div>
      )}
    </div>
  )
}
