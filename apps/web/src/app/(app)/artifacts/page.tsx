'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Code2, FileText, Copy, Check, Trash2, AlertCircle, Boxes, MessageSquare, X,
} from 'lucide-react'
import { toast } from 'sonner'
import { AppShell } from '@/components/app-shell'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { getKroexClient } from '@/lib/kroex-client'
import { getApiError } from '@/lib/api'
import { cn } from '@/lib/utils'
import type { ArtifactOut } from '@kroex/api'

export default function ArtifactsPage() {
  const qc = useQueryClient()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<ArtifactOut | null>(null)

  const { data: artifacts, isLoading, isError, error, refetch, isRefetching } = useQuery({
    queryKey: ['artifacts'],
    queryFn: () => getKroexClient().artifacts.list(),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => getKroexClient().artifacts.remove(id),
    onSuccess: (_d, id) => {
      setPendingDelete(null)
      if (selectedId === id) setSelectedId(null)
      qc.invalidateQueries({ queryKey: ['artifacts'] })
    },
    onError: (e) => { toast.error(getApiError(e)); setPendingDelete(null) },
  })

  const selected = artifacts?.find((a) => a.id === selectedId) ?? null

  return (
    <AppShell>
      <div className="flex h-full overflow-hidden">
        {/* List */}
        <div className={cn('flex flex-col min-w-0 border-r border-border transition-all', selected ? 'hidden md:flex md:w-[44%]' : 'flex-1')}>
          <header className="px-6 py-5 border-b border-border">
            <h1 className="text-xl font-semibold">Artifacts</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Code and documents KROEX generated in conversations.
            </p>
          </header>
          <div className="flex-1 overflow-y-auto p-4">
            {isLoading ? (
              <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-16 rounded-xl skeleton" />)}</div>
            ) : isError ? (
              <div className="flex flex-col items-center text-center py-16">
                <AlertCircle className="h-9 w-9 text-destructive mb-3" />
                <p className="font-semibold">Couldn&apos;t load artifacts</p>
                <p className="text-sm text-muted-foreground mt-1">{getApiError(error)}</p>
                <Button variant="outline" className="mt-4" loading={isRefetching} onClick={() => refetch()}>Retry</Button>
              </div>
            ) : (artifacts && artifacts.length > 0) ? (
              <ul className="space-y-2">
                {artifacts.map((a) => (
                  <ArtifactRow key={a.id} artifact={a} active={a.id === selectedId} onOpen={() => setSelectedId(a.id)} />
                ))}
              </ul>
            ) : (
              <div className="flex flex-col items-center text-center py-20">
                <div className="h-14 w-14 rounded-2xl bg-secondary flex items-center justify-center mb-4">
                  <Boxes className="h-7 w-7 text-muted-foreground" />
                </div>
                <h2 className="text-lg font-semibold">No artifacts yet</h2>
                <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                  Artifacts are created automatically when KROEX writes code or documents in a chat. They can&apos;t be created here directly.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Detail */}
        {selected && (
          <ArtifactDetail
            artifact={selected}
            onClose={() => setSelectedId(null)}
            onDelete={() => setPendingDelete(selected)}
          />
        )}
      </div>

      <Dialog open={!!pendingDelete} onOpenChange={(v) => !v && setPendingDelete(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete artifact?</DialogTitle>
            <DialogDescription>&ldquo;{pendingDelete?.title}&rdquo; will be permanently removed.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPendingDelete(null)}>Cancel</Button>
            <Button variant="destructive" loading={deleteMutation.isPending} onClick={() => pendingDelete && deleteMutation.mutate(pendingDelete.id)}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  )
}

function ArtifactRow({ artifact, active, onOpen }: { artifact: ArtifactOut; active: boolean; onOpen: () => void }) {
  const isCode = artifact.type === 'code'
  return (
    <li>
      <button
        onClick={onOpen}
        className={cn(
          'w-full text-left flex items-start gap-3 rounded-xl border px-4 py-3 transition-all',
          active ? 'border-primary/40 bg-secondary/50' : 'border-border bg-card hover:border-primary/30'
        )}
      >
        {isCode ? <Code2 className="h-5 w-5 text-primary shrink-0 mt-0.5" /> : <FileText className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium truncate">{artifact.title}</p>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="muted" className="capitalize">{artifact.language || artifact.type}</Badge>
            <span className="text-xs text-muted-foreground">{new Date(artifact.created_at).toLocaleDateString()}</span>
          </div>
        </div>
      </button>
    </li>
  )
}

function ArtifactDetail({ artifact, onClose, onDelete }: { artifact: ArtifactOut; onClose: () => void; onDelete: () => void }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(artifact.content)
      setCopied(true); setTimeout(() => setCopied(false), 1800)
    } catch { toast.error('Copy failed') }
  }
  return (
    <div className="flex-1 flex flex-col min-w-0">
      <header className="flex items-center gap-2 px-5 py-3.5 border-b border-border">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium truncate">{artifact.title}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <Badge variant="muted" className="capitalize">{artifact.language || artifact.type}</Badge>
            <Link href={`/chat/${artifact.conversation_id}`} className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
              <MessageSquare className="h-3 w-3" /> View conversation
            </Link>
          </div>
        </div>
        <Button size="sm" variant="outline" className="gap-1.5" onClick={copy} data-testid="copy-artifact">
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? 'Copied' : 'Copy'}
        </Button>
        <Button size="icon-sm" variant="ghost" className="text-muted-foreground hover:text-destructive" aria-label="Delete artifact" onClick={onDelete}>
          <Trash2 className="h-4 w-4" />
        </Button>
        <Button size="icon-sm" variant="ghost" className="text-muted-foreground md:hidden" aria-label="Close" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </header>
      <ScrollArea className="flex-1">
        <pre className="p-5 text-sm font-mono leading-relaxed whitespace-pre overflow-x-auto text-foreground">
          <code>{artifact.content}</code>
        </pre>
      </ScrollArea>
    </div>
  )
}
