'use client'
import { useState, useRef, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Send, Square, Paperclip, Zap,
  X, FileText, ChevronDown,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { WithTooltip } from '@/components/ui/tooltip'
import { cn, formatBytes, isImageFile } from '@/lib/utils'
import { useSettingsStore } from '@/store/settings'

interface ComposerFile {
  id: string
  file: File
  preview?: string
}

interface ComposerProps {
  onSend: (content: string, files: File[]) => Promise<void>
  onStop?: () => void
  isStreaming?: boolean
  disabled?: boolean
  placeholder?: string
  model?: string
  onModelClick?: () => void
}

export function Composer({
  onSend,
  onStop,
  isStreaming,
  disabled,
  placeholder = 'Message KROEX…',
  model,
  onModelClick,
}: ComposerProps) {
  const [text, setText] = useState('')
  const [files, setFiles] = useState<ComposerFile[]>([])
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { enterToSend } = useSettingsStore()

  useEffect(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = `${Math.min(ta.scrollHeight, 300)}px`
  }, [text])

  const submit = useCallback(async () => {
    const trimmed = text.trim()
    if (!trimmed && files.length === 0) return
    if (isStreaming) return
    const fileList = files.map(f => f.file)
    setText('')
    setFiles([])
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
    await onSend(trimmed, fileList)
  }, [text, files, isStreaming, onSend])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (enterToSend && !e.shiftKey) { e.preventDefault(); submit() }
      else if (!enterToSend && (e.metaKey || e.ctrlKey)) { e.preventDefault(); submit() }
    }
  }

  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newFiles = Array.from(e.target.files ?? []).map(f => ({
      id: crypto.randomUUID(),
      file: f,
      preview: isImageFile(f.name) ? URL.createObjectURL(f) : undefined,
    }))
    setFiles(prev => [...prev, ...newFiles])
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const removeFile = (id: string) => {
    setFiles(prev => {
      const f = prev.find(x => x.id === id)
      if (f?.preview) URL.revokeObjectURL(f.preview)
      return prev.filter(x => x.id !== id)
    })
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = Array.from(e.clipboardData.items)
    const imageItems = items.filter(i => i.kind === 'file' && i.type.startsWith('image/'))
    if (imageItems.length > 0) {
      e.preventDefault()
      const newFiles = imageItems.map(item => {
        const file = item.getAsFile()!
        return { id: crypto.randomUUID(), file, preview: URL.createObjectURL(file) }
      })
      setFiles(prev => [...prev, ...newFiles])
    }
  }

  const hasContent = text.trim().length > 0 || files.length > 0

  return (
    <div className="px-4 pb-4 pt-2">
      {model && (
        <div className="flex justify-center mb-2">
          <button
            onClick={onModelClick}
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors bg-secondary/60 rounded-full px-3 py-1 hover:bg-secondary"
          >
            <Zap className="h-3 w-3" />
            {model}
            <ChevronDown className="h-3 w-3" />
          </button>
        </div>
      )}

      <div className="composer mx-auto" style={{ maxWidth: 'var(--chat-max-width)' }}>
        <AnimatePresence>
          {files.length > 0 && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="flex flex-wrap gap-2 p-3 pb-0"
            >
              {files.map(f => (
                <div
                  key={f.id}
                  className="relative flex items-center gap-2 bg-secondary rounded-xl px-3 py-2 text-sm max-w-[200px] group"
                >
                  {f.preview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={f.preview} alt="" className="h-8 w-8 object-cover rounded-lg" />
                  ) : (
                    <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium">{f.file.name}</p>
                    <p className="text-xs text-muted-foreground">{formatBytes(f.file.size)}</p>
                  </div>
                  <button
                    onClick={() => removeFile(f.id)}
                    className="absolute -top-1.5 -right-1.5 bg-muted border border-border rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex items-end gap-2 p-3">
          <div className="flex-1 min-w-0">
            <textarea
              ref={textareaRef}
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder={placeholder}
              disabled={disabled}
              rows={1}
              className={cn(
                'w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground',
                'resize-none outline-none border-none leading-relaxed',
                'max-h-[300px] overflow-y-auto',
                disabled && 'opacity-50 cursor-not-allowed'
              )}
            />
          </div>
        </div>

        <div className="flex items-center justify-between px-3 pb-2.5">
          <div className="flex items-center gap-0.5">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,.pdf,.doc,.docx,.txt,.md,.csv,.json,.xml,.py,.js,.ts,.jsx,.tsx,.html,.css"
              onChange={handleFiles}
              className="hidden"
            />
            <WithTooltip tip="Attach files">
              <Button
                size="icon-sm"
                variant="ghost"
                className="h-7 w-7 text-muted-foreground"
                onClick={() => fileInputRef.current?.click()}
              >
                <Paperclip className="h-4 w-4" />
              </Button>
            </WithTooltip>

          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground/50 hidden sm:block">
              {enterToSend ? '↵ send' : '⌘↵ send'}
            </span>
            {isStreaming ? (
              <WithTooltip tip="Stop generating">
                <Button
                  size="icon-sm"
                  variant="outline"
                  className="h-8 w-8 rounded-xl text-destructive border-destructive/30 hover:bg-destructive/10"
                  onClick={onStop}
                >
                  <Square className="h-3.5 w-3.5" fill="currentColor" />
                </Button>
              </WithTooltip>
            ) : (
              <WithTooltip tip="Send message">
                <Button
                  size="icon-sm"
                  onClick={submit}
                  disabled={!hasContent || disabled}
                  className={cn(
                    'h-8 w-8 rounded-xl transition-all duration-150',
                    hasContent
                      ? 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm shadow-primary/20'
                      : 'bg-muted text-muted-foreground cursor-not-allowed'
                  )}
                >
                  <Send className="h-3.5 w-3.5" />
                </Button>
              </WithTooltip>
            )}
          </div>
        </div>
      </div>

      <p className="text-center text-xs text-muted-foreground/50 mt-2">
        KROEX can make mistakes. Verify important information.
      </p>
    </div>
  )
}
