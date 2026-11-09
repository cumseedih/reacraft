'use client'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X, Download, Copy, Check, ExternalLink, Code2, FileText,
  Globe, BarChart2, GitBranch, Presentation, ChevronDown,
  Maximize2, Minimize2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { WithTooltip } from '@/components/ui/tooltip'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import type { Artifact, ArtifactType } from '@/types'
import { useChatStore } from '@/store/chat'

const ARTIFACT_ICONS: Record<ArtifactType, React.ElementType> = {
  code:         Code2,
  html:         Globe,
  react:        Code2,
  markdown:     FileText,
  chart:        BarChart2,
  diagram:      GitBranch,
  presentation: Presentation,
  document:     FileText,
}

const ARTIFACT_LABELS: Record<ArtifactType, string> = {
  code:         'Code',
  html:         'HTML Preview',
  react:        'React Component',
  markdown:     'Document',
  chart:        'Chart',
  diagram:      'Diagram',
  presentation: 'Presentation',
  document:     'Document',
}

interface ArtifactPanelProps {
  artifact: Artifact
  onClose: () => void
}

export function ArtifactPanel({ artifact, onClose }: ArtifactPanelProps) {
  const [copied, setCopied] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  const [activeTab, setActiveTab] = useState<'preview' | 'source'>('preview')
  const Icon = ARTIFACT_ICONS[artifact.type] ?? FileText

  const copy = async () => {
    await navigator.clipboard.writeText(artifact.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const download = () => {
    const extensions: Record<ArtifactType, string> = {
      code: artifact.language ?? 'txt',
      html: 'html',
      react: 'tsx',
      markdown: 'md',
      chart: 'json',
      diagram: 'txt',
      presentation: 'html',
      document: 'md',
    }
    const ext = extensions[artifact.type]
    const blob = new Blob([artifact.content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${artifact.title.replace(/\s+/g, '-').toLowerCase()}.${ext}`
    a.click()
    URL.revokeObjectURL(url)
  }

  const showPreview = artifact.type === 'html' || artifact.type === 'react'
  const showSource  = artifact.type !== 'html' && artifact.type !== 'react'

  return (
    <motion.div
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 24 }}
      transition={{ duration: 0.2 }}
      className={cn(
        'artifact-panel flex flex-col',
        fullscreen ? 'fixed inset-4 z-50 rounded-2xl shadow-2xl' : 'relative'
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border/50">
        <Icon className="h-4 w-4 text-primary shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{artifact.title}</p>
          <p className="text-xs text-muted-foreground">{ARTIFACT_LABELS[artifact.type]}</p>
        </div>
        <div className="flex items-center gap-0.5">
          {showPreview && (
            <div className="flex border border-border rounded-lg mr-1 overflow-hidden">
              {(['preview', 'source'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    'px-2.5 py-1 text-xs capitalize transition-colors',
                    activeTab === tab
                      ? 'bg-secondary text-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {tab}
                </button>
              ))}
            </div>
          )}
          <WithTooltip tip={copied ? 'Copied!' : 'Copy'}>
            <Button size="icon-sm" variant="ghost" className="h-7 w-7 text-muted-foreground" onClick={copy}>
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            </Button>
          </WithTooltip>
          <WithTooltip tip="Download">
            <Button size="icon-sm" variant="ghost" className="h-7 w-7 text-muted-foreground" onClick={download}>
              <Download className="h-3.5 w-3.5" />
            </Button>
          </WithTooltip>
          <WithTooltip tip={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}>
            <Button size="icon-sm" variant="ghost" className="h-7 w-7 text-muted-foreground" onClick={() => setFullscreen(v => !v)}>
              {fullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            </Button>
          </WithTooltip>
          <WithTooltip tip="Close">
            <Button size="icon-sm" variant="ghost" className="h-7 w-7 text-muted-foreground" onClick={onClose}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </WithTooltip>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {showPreview && activeTab === 'preview' ? (
          <iframe
            srcDoc={artifact.content}
            title={artifact.title}
            sandbox="allow-scripts allow-same-origin"
            className="w-full h-full border-none bg-white"
          />
        ) : (
          <ScrollArea className="h-full">
            <pre className="p-4 text-sm font-mono leading-relaxed text-foreground overflow-x-auto whitespace-pre">
              <code>{artifact.content}</code>
            </pre>
          </ScrollArea>
        )}
      </div>
    </motion.div>
  )
}
