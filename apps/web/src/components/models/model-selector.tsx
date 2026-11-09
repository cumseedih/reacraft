'use client'
import { motion } from 'framer-motion'
import { Check, Zap, Brain, Sparkles, FlaskConical } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { Model } from '@/types'

const MODEL_DEFAULTS: Omit<Model, 'id' | 'name' | 'provider' | 'contextWindow' | 'tier' | 'description' | 'capabilities'> = {
  supportsImages: true, supportsFiles: true, supportsVoice: false,
  supportsSearch: false, supportsArtifacts: true,
  maxOutputTokens: 4096, inputCostPer1k: 0, outputCostPer1k: 0,
}

const FEATURED_MODELS: Model[] = [
  { ...MODEL_DEFAULTS, id: 'kroex-ultra', name: 'KROEX Ultra', provider: 'kroex', description: 'Maximum intelligence for complex, nuanced tasks', contextWindow: 200000, capabilities: ['vision', 'code', 'reasoning', 'documents'], tier: 'ultra' },
  { ...MODEL_DEFAULTS, id: 'kroex-pro',   name: 'KROEX Pro',   provider: 'kroex', description: 'Balanced power and speed for most tasks',           contextWindow: 100000, capabilities: ['vision', 'code', 'reasoning'],            tier: 'pro'   },
  { ...MODEL_DEFAULTS, id: 'kroex-fast',  name: 'KROEX Fast',  provider: 'kroex', description: 'Lightweight and snappy for quick answers',           contextWindow:  32000, capabilities: ['code', 'reasoning'],                       tier: 'free'  },
]

const TIER_ICONS = {
  ultra:    Brain,
  pro:      Sparkles,
  free:     Zap,
  research: FlaskConical,
}

const TIER_COLORS = {
  ultra:    'text-purple-500',
  pro:      'text-primary',
  free:     'text-emerald-500',
  research: 'text-orange-500',
}

interface ModelSelectorProps {
  open: boolean
  onClose: () => void
  selectedModel: string
  onSelect: (modelId: string) => void
}

export function ModelSelector({ open, onClose, selectedModel, onSelect }: ModelSelectorProps) {
  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Choose a model</DialogTitle>
        </DialogHeader>
        <div className="space-y-2 mt-2">
          {FEATURED_MODELS.map(model => {
            const Icon = TIER_ICONS[model.tier ?? 'free'] ?? Zap
            const isSelected = selectedModel === model.id
            return (
              <motion.button
                key={model.id}
                whileTap={{ scale: 0.99 }}
                onClick={() => { onSelect(model.id); onClose() }}
                className={cn(
                  'w-full flex items-start gap-3 rounded-xl p-3 text-left transition-colors border',
                  isSelected
                    ? 'bg-primary/8 border-primary/30'
                    : 'border-transparent hover:bg-secondary hover:border-border'
                )}
              >
                <div className={cn('mt-0.5', TIER_COLORS[model.tier ?? 'free'])}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{model.name}</span>
                    {model.tier === 'ultra' && <Badge variant="secondary" className="text-xs">Pro</Badge>}
                    {isSelected && <Check className="h-3.5 w-3.5 text-primary ml-auto" />}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{model.description}</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-xs text-muted-foreground/70">
                      {(model.contextWindow / 1000).toFixed(0)}K context
                    </span>
                    {(model.capabilities ?? []).slice(0, 3).map(cap => (
                      <span key={cap} className="text-xs bg-secondary rounded-full px-2 py-0.5 text-muted-foreground capitalize">
                        {cap}
                      </span>
                    ))}
                  </div>
                </div>
              </motion.button>
            )
          })}
        </div>
        <p className="text-xs text-muted-foreground/60 mt-2">
          Model selection applies to this conversation. Configure defaults in Settings.
        </p>
      </DialogContent>
    </Dialog>
  )
}
