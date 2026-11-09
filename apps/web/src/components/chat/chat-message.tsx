'use client'
import { useState } from 'react'
import Image from 'next/image'
import { motion } from 'framer-motion'
import {
  ThumbsUp, ThumbsDown, Copy, Check, RefreshCw, Edit2,
  Volume2, ChevronDown, ChevronUp, MoreHorizontal,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { WithTooltip } from '@/components/ui/tooltip'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { MessageRenderer } from './message-renderer'
import { cn, formatDate } from '@/lib/utils'
import type { Message } from '@/types'
import { useAuthStore } from '@/store/auth'

interface ChatMessageProps {
  message: Message
  onRegenerate?: () => void
  onEdit?: (content: string) => void
  onFeedback?: (id: string, feedback: 'up' | 'down' | null) => void
}

export function ChatMessage({ message, onRegenerate, onEdit, onFeedback }: ChatMessageProps) {
  const { user } = useAuthStore()
  const [copied, setCopied] = useState(false)
  const [expanded, setExpanded] = useState(true)
  const isUser = message.role === 'user'
  const content = typeof message.content === 'string' ? message.content : ''
  const isLong = content.length > 1200

  const copy = async () => {
    await navigator.clipboard.writeText(content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (isUser) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex justify-end mb-6 group"
      >
        <div className="flex items-end gap-2 max-w-[85%]">
          <div className="message-user">
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{content}</p>
            {message.attachments?.map(att => (
              <div key={att.id} className="mt-2 text-xs text-muted-foreground flex items-center gap-1">
                📎 {att.name}
              </div>
            ))}
          </div>
          <Avatar className="h-7 w-7 shrink-0 mb-0.5">
            <AvatarImage src={user?.avatar} />
            <AvatarFallback className="text-xs bg-primary/10 text-primary">
              {user?.name?.[0]?.toUpperCase() ?? 'U'}
            </AvatarFallback>
          </Avatar>
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-6 group"
    >
      <div className="flex gap-3">
        <div className="shrink-0 mt-0.5">
          <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden">
            <Image
              src="/assets/kroex-raven.png"
              alt="KROEX"
              width={28}
              height={28}
              className="object-cover"
            />
          </div>
        </div>

        <div className="flex-1 min-w-0">
          {message.status === 'streaming' && (
            <div className="flex items-center gap-1.5 mb-2">
              <span className="text-xs text-muted-foreground">KROEX</span>
              <div className="flex gap-0.5">
                {[0,1,2].map(i => (
                  <span
                    key={i}
                    className="w-1 h-1 bg-primary rounded-full animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }}
                  />
                ))}
              </div>
            </div>
          )}

          {message.status === 'error' && (
            <div className="text-sm text-destructive mb-2 flex items-center gap-2">
              <span>⚠</span> Something went wrong. Try regenerating.
            </div>
          )}

          {content && (
            <div className={cn('relative', isLong && !expanded && 'max-h-64 overflow-hidden')}>
              <MessageRenderer
                content={content}
                isStreaming={message.status === 'streaming'}
              />
              {isLong && !expanded && (
                <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-background to-transparent" />
              )}
            </div>
          )}

          {isLong && (
            <button
              onClick={() => setExpanded(v => !v)}
              className="flex items-center gap-1 text-xs text-primary mt-1 hover:text-primary/80"
            >
              {expanded ? <><ChevronUp className="h-3 w-3"/> Show less</> : <><ChevronDown className="h-3 w-3"/> Show more</>}
            </button>
          )}

          {message.model && message.status === 'done' && (
            <p className="text-xs text-muted-foreground/60 mt-1">
              {message.model}
              {message.tokens && ` · ${message.tokens.output} tokens`}
            </p>
          )}

          {message.status === 'done' && (
            <div className="flex items-center gap-0.5 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <WithTooltip tip={copied ? 'Copied!' : 'Copy'}>
                <Button size="icon-sm" variant="ghost" className="h-7 w-7 text-muted-foreground" onClick={copy}>
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                </Button>
              </WithTooltip>
              {onRegenerate && (
                <WithTooltip tip="Regenerate">
                  <Button size="icon-sm" variant="ghost" className="h-7 w-7 text-muted-foreground" onClick={onRegenerate}>
                    <RefreshCw className="h-3.5 w-3.5" />
                  </Button>
                </WithTooltip>
              )}
              <WithTooltip tip="Good response">
                <Button
                  size="icon-sm"
                  variant="ghost"
                  className={cn('h-7 w-7', message.feedback === 'up' ? 'text-primary' : 'text-muted-foreground')}
                  onClick={() => onFeedback?.(message.id, message.feedback === 'up' ? null : 'up')}
                >
                  <ThumbsUp className="h-3.5 w-3.5" />
                </Button>
              </WithTooltip>
              <WithTooltip tip="Bad response">
                <Button
                  size="icon-sm"
                  variant="ghost"
                  className={cn('h-7 w-7', message.feedback === 'down' ? 'text-destructive' : 'text-muted-foreground')}
                  onClick={() => onFeedback?.(message.id, message.feedback === 'down' ? null : 'down')}
                >
                  <ThumbsDown className="h-3.5 w-3.5" />
                </Button>
              </WithTooltip>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  )
}
