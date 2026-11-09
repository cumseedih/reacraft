'use client'
import { memo, useState, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import rehypeHighlight from 'rehype-highlight'
import { Check, Copy, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { WithTooltip } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import 'katex/dist/katex.min.css'

interface MessageRendererProps {
  content: string
  isStreaming?: boolean
  className?: string
}

export const MessageRenderer = memo(function MessageRenderer({
  content,
  isStreaming,
  className,
}: MessageRendererProps) {
  return (
    <div className={cn('prose-kroex', isStreaming && 'streaming-cursor', className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex, [rehypeHighlight, { detect: true }]]}
        components={{
          code: CodeBlock,
          pre: PreWrapper,
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline underline-offset-2 hover:text-primary/80 inline-flex items-center gap-0.5"
            >
              {children}
              <ExternalLink className="inline h-3 w-3 opacity-60" />
            </a>
          ),
          table: ({ children }) => (
            <div className="overflow-x-auto my-4">
              <table className="w-full text-sm">{children}</table>
            </div>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-primary/30 pl-4 italic text-muted-foreground my-4 bg-secondary/30 py-2 rounded-r-lg">
              {children}
            </blockquote>
          ),
          img: ({ src, alt }) => (
            <span className="block my-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt={alt ?? ''} className="rounded-xl max-w-full h-auto shadow-sm" />
            </span>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
})

function PreWrapper({ children, ...props }: React.HTMLProps<HTMLPreElement>) {
  return <pre {...props}>{children}</pre>
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CodeBlock({ className, children, ...props }: any) {
  const [copied, setCopied] = useState(false)
  const isInline = !className && typeof children === 'string' && !children.includes('\n')

  const copy = useCallback(async () => {
    await navigator.clipboard.writeText(String(children))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [children])

  if (isInline) {
    return (
      <code className="bg-secondary text-foreground rounded px-1.5 py-0.5 text-sm font-mono" {...props}>
        {children}
      </code>
    )
  }

  const language = className?.replace('language-', '') ?? 'text'

  return (
    <div className="code-block group">
      <div className="code-block-header">
        <span className="text-warm-400">{language}</span>
        <div className="flex items-center gap-1">
          <WithTooltip tip={copied ? 'Copied!' : 'Copy code'}>
            <Button
              size="icon-sm"
              variant="ghost"
              onClick={copy}
              className="h-6 w-6 text-warm-400 hover:text-warm-100"
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            </Button>
          </WithTooltip>
        </div>
      </div>
      <code className={cn(className, 'hljs')} {...props}>
        {children}
      </code>
    </div>
  )
}
