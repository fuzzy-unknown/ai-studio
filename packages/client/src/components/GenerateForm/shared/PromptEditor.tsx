import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'

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

export interface PromptEditorHandle {
  setContent: (prompt: string, imageUrls: string[]) => void
}

export interface PromptEditorProps {
  value: string
  imageUrls: string[]
  onChange: (prompt: string) => void
  onInsertImageRef: (index: number) => void
  placeholder: string
  disabled: boolean
  showMentions: boolean
}

export const PromptEditor = forwardRef<PromptEditorHandle, PromptEditorProps>(
  function PromptEditor(props, ref) {
    const {
      value,
      imageUrls,
      onChange,
      onInsertImageRef,
      placeholder,
      disabled,
      showMentions,
    } = props

    const editorRef = useRef<HTMLDivElement>(null)
    const [mentionOpen, setMentionOpen] = useState(false)

    // Expose setContent for parent to insert [Image N] references
    useImperativeHandle(ref, () => ({
      setContent(newPrompt: string, urls: string[]) {
        onChange(newPrompt)
        if (editorRef.current) {
          editorRef.current.innerHTML = promptToHtml(newPrompt, urls)
          if (newPrompt.length > 0)
            placeCursorAtEnd(editorRef.current)
        }
      },
    }), [onChange])

    // Re-render thumbnails when imageUrls change
    useEffect(() => {
      if (value.includes('[Image ') && editorRef.current) {
        editorRef.current.innerHTML = promptToHtml(value, imageUrls)
        placeCursorAtEnd(editorRef.current)
      }
    }, [imageUrls, value])

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

    const handleInput = useCallback(() => {
      if (!editorRef.current)
        return
      const newPrompt = domToPrompt(editorRef.current)
      onChange(newPrompt)
      if (showMentions && imageUrls.length > 0 && newPrompt.endsWith('@'))
        setMentionOpen(true)
      else
        setMentionOpen(false)
    }, [showMentions, imageUrls.length, onChange])

    const handlePaste = useCallback((e: React.ClipboardEvent<HTMLDivElement>) => {
      e.preventDefault()
      const text = getPasteText(e)
      document.execCommand('insertText', false, text)
    }, [])

    const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
      if (mentionOpen && e.key === 'Escape') {
        setMentionOpen(false)
        e.preventDefault()
      }
    }, [mentionOpen])

    const handleInsertRef = useCallback((imageIndex: number) => {
      onInsertImageRef(imageIndex)
      setMentionOpen(false)
    }, [onInsertImageRef])

    return (
      <div className="prompt-wrapper">
        <div
          ref={editorRef}
          className="prompt-editor"
          contentEditable={!disabled}
          suppressContentEditableWarning
          onInput={handleInput}
          onPaste={handlePaste}
          onKeyDown={handleKeyDown}
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
                onClick={() => handleInsertRef(i + 1)}
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
    )
  },
)
