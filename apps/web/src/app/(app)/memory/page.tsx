'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Brain, Plus, Trash2, Search, AlertCircle, X } from 'lucide-react'
import { toast } from 'sonner'
import { AppShell } from '@/components/app-shell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { getKroexClient } from '@/lib/kroex-client'
import { getApiError } from '@/lib/api'
import { RetrievalMethodNote } from '@/components/memory/retrieval-method-note'
import type { MemoryOut, MemorySearchResult } from '@kroex/api'

export default function MemoryPage() {
  const qc = useQueryClient()
  const [draft, setDraft] = useState('')
  const [query, setQuery] = useState('')
  const [searchResult, setSearchResult] = useState<MemorySearchResult | null>(null)
  const [pendingDelete, setPendingDelete] = useState<MemoryOut | null>(null)

  const listQuery = useQuery({
    queryKey: ['memories'],
    queryFn: () => getKroexClient().memory.list(),
  })

  const createMutation = useMutation({
    mutationFn: (content: string) => getKroexClient().memory.create({ content }),
    onSuccess: () => { setDraft(''); qc.invalidateQueries({ queryKey: ['memories'] }); toast.success('Memory saved') },
    onError: (e) => toast.error(getApiError(e)),
  })

  const deleteMutation = useMutation({
    mutationFn: (memoryId: string) => getKroexClient().memory.remove(memoryId),
    onSuccess: () => { setPendingDelete(null); qc.invalidateQueries({ queryKey: ['memories'] }) },
    onError: (e) => { toast.error(getApiError(e)); setPendingDelete(null) },
  })

  const searchMutation = useMutation({
    mutationFn: (q: string) => getKroexClient().memory.search(q, 5),
    onSuccess: (res) => setSearchResult(res),
    onError: (e) => toast.error(getApiError(e)),
  })

  const memories = listQuery.data ?? []

  return (
    <AppShell>
      <div className="flex h-full flex-col overflow-hidden">
        <header className="px-8 py-6 border-b border-border">
          <h1 className="text-xl font-semibold">Memory</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Facts KROEX remembers about you and recalls in conversations.
          </p>
        </header>

        <div className="flex-1 overflow-y-auto p-8 max-w-2xl w-full mx-auto space-y-8">
          {/* Create */}
          <section>
            <form onSubmit={(e) => { e.preventDefault(); if (draft.trim()) createMutation.mutate(draft.trim()) }}>
              <label className="text-sm font-semibold mb-2 block">Add a memory</label>
              <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={2}
                placeholder="e.g. I prefer concise answers and TypeScript examples." />
              <div className="flex justify-end mt-2">
                <Button type="submit" size="sm" className="gap-2" loading={createMutation.isPending} disabled={!draft.trim()}>
                  <Plus className="h-4 w-4" /> Save memory
                </Button>
              </div>
            </form>
          </section>

          {/* Search */}
          <section>
            <label className="text-sm font-semibold mb-2 block">Search memories</label>
            <form onSubmit={(e) => { e.preventDefault(); if (query.trim()) searchMutation.mutate(query.trim()) }} className="flex gap-2">
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="What should KROEX recall?" startIcon={<Search className="h-4 w-4" />} />
              <Button type="submit" variant="outline" loading={searchMutation.isPending} disabled={!query.trim()}>Search</Button>
            </form>
            {searchResult && <SearchResults result={searchResult} onClear={() => setSearchResult(null)} />}
          </section>

          {/* List */}
          <section>
            <h2 className="text-sm font-semibold mb-3">All memories</h2>
            {listQuery.isLoading ? (
              <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-16 rounded-xl skeleton" />)}</div>
            ) : listQuery.isError ? (
              <div className="rounded-xl border border-border p-6 text-center">
                <AlertCircle className="h-8 w-8 text-destructive mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">{getApiError(listQuery.error)}</p>
                <Button variant="outline" size="sm" className="mt-3" onClick={() => listQuery.refetch()}>Retry</Button>
              </div>
            ) : memories.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border py-12 text-center">
                <Brain className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No memories yet</p>
                <p className="text-xs text-muted-foreground/70 mt-1">Add one above, or KROEX will save them from conversations.</p>
              </div>
            ) : (
              <ul className="space-y-2">
                {memories.map((m) => (
                  <li key={m.id} className="group flex items-start gap-3 rounded-xl border border-border bg-card px-4 py-3">
                    <Brain className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm">{m.content}</p>
                      <p className="text-xs text-muted-foreground mt-1">{m.source}</p>
                    </div>
                    <Button size="icon-sm" variant="ghost" className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                      aria-label="Delete memory" onClick={() => setPendingDelete(m)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>

      <Dialog open={!!pendingDelete} onOpenChange={(v) => !v && setPendingDelete(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete memory?</DialogTitle>
            <DialogDescription>This fact will no longer be recalled in conversations.</DialogDescription>
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

function SearchResults({ result, onClear }: { result: MemorySearchResult; onClear: () => void }) {
  return (
    <div className="mt-3 rounded-xl border border-border bg-secondary/30 p-4">
      <div className="flex items-start justify-between gap-2 mb-3">
        {/* Honest indication — recency fallback is never presented as semantic RAG. */}
        <RetrievalMethodNote method={result.method} />
        <button onClick={onClear} className="text-muted-foreground hover:text-foreground shrink-0" aria-label="Clear results"><X className="h-4 w-4" /></button>
      </div>
      {result.contents.length === 0 ? (
        <p className="text-sm text-muted-foreground">No matches.</p>
      ) : (
        <ul className="space-y-1.5">
          {result.contents.map((c, i) => (
            <li key={i} className="text-sm rounded-lg bg-background border border-border px-3 py-2">{c}</li>
          ))}
        </ul>
      )}
    </div>
  )
}
