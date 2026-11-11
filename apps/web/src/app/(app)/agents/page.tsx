'use client'
import { useEffect, useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Bot, Plus, Play, Square, AlertCircle, Loader2, Cpu } from 'lucide-react'
import { toast } from 'sonner'
import { AppShell } from '@/components/app-shell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { PatchCard } from '@/components/agents/patch-card'
import { describeRunStatus } from '@/lib/agent-runs'
import { getKroexClient } from '@/lib/kroex-client'
import { agentRunEvents, getApiError } from '@/lib/api'
import { KROEX_MODEL_IDS, KroexApiError, isTerminalRunStatus, type AgentOut, type AgentRunOut } from '@kroex/api'
import { cn } from '@/lib/utils'

export default function AgentsPage() {
  const qc = useQueryClient()
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)

  const agentsQuery = useQuery({
    queryKey: ['agents'],
    queryFn: () => getKroexClient().agents.list(),
    retry: false,
  })

  if (agentsQuery.isError && agentsQuery.error instanceof KroexApiError && agentsQuery.error.status === 404) {
    return (
      <AppShell>
        <div className="flex h-full flex-col items-center justify-center text-center p-8">
          <div className="h-14 w-14 rounded-2xl bg-secondary flex items-center justify-center mb-4"><Bot className="h-7 w-7 text-muted-foreground" /></div>
          <h1 className="text-lg font-semibold">Agents are not enabled</h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm">This backend does not have the Agents feature turned on (<code className="text-xs">AGENTS_ENABLED</code>).</p>
        </div>
      </AppShell>
    )
  }

  const agents = agentsQuery.data ?? []
  const current = agents.find((a) => a.id === selectedAgent) ?? agents[0] ?? null

  return (
    <AppShell>
      <div className="flex h-full overflow-hidden">
        {/* Agent list */}
        <div className="w-72 shrink-0 border-r border-border flex flex-col">
          <header className="flex items-center justify-between px-4 py-4 border-b border-border">
            <h1 className="text-base font-semibold">Agents</h1>
            <Button size="icon-sm" onClick={() => setCreateOpen(true)} aria-label="New agent"><Plus className="h-4 w-4" /></Button>
          </header>
          <div className="flex-1 overflow-y-auto p-2">
            {agentsQuery.isLoading ? (
              <div className="space-y-2 p-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-12 rounded-xl skeleton" />)}</div>
            ) : agentsQuery.isError ? (
              <div className="text-center py-10 px-3"><AlertCircle className="h-7 w-7 text-destructive mx-auto mb-2" /><p className="text-sm text-muted-foreground">{getApiError(agentsQuery.error)}</p></div>
            ) : agents.length === 0 ? (
              <div className="text-center py-12 px-3"><p className="text-sm text-muted-foreground">No agents yet</p><Button size="sm" className="mt-3 gap-1.5" onClick={() => setCreateOpen(true)}><Plus className="h-3.5 w-3.5" /> New agent</Button></div>
            ) : agents.map((a) => (
              <button key={a.id} onClick={() => setSelectedAgent(a.id)}
                className={cn('w-full text-left rounded-xl px-3 py-2.5 transition-colors', current?.id === a.id ? 'bg-secondary' : 'hover:bg-muted/60')}>
                <p className="text-sm font-medium truncate">{a.name}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Badge variant="muted">{a.model}</Badge>
                  {!a.enabled && <Badge variant="outline" className="text-muted-foreground">disabled</Badge>}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Agent detail */}
        <div className="flex-1 min-w-0">
          {current ? <AgentDetail agent={current} /> : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Select or create an agent.</div>
          )}
        </div>
      </div>

      <CreateAgentDialog open={createOpen} onOpenChange={setCreateOpen}
        onCreated={(a) => { qc.invalidateQueries({ queryKey: ['agents'] }); setSelectedAgent(a.id); setCreateOpen(false) }} />
    </AppShell>
  )
}

function AgentDetail({ agent }: { agent: AgentOut }) {
  const qc = useQueryClient()
  const [prompt, setPrompt] = useState('')
  const [activeRun, setActiveRun] = useState<string | null>(null)

  const runsQuery = useQuery({
    queryKey: ['agent-runs', agent.id],
    queryFn: () => getKroexClient().agents.listRuns(agent.id),
    retry: false,
  })

  const runMutation = useMutation({
    mutationFn: () => getKroexClient().agents.run(agent.id, { prompt: prompt.trim() || null }),
    onSuccess: (run) => { setPrompt(''); setActiveRun(run.id); qc.invalidateQueries({ queryKey: ['agent-runs', agent.id] }); toast.success('Run queued') },
    onError: (e) => toast.error(getApiError(e)),
  })

  const runs = runsQuery.data ?? []

  return (
    <div className="flex flex-col h-full">
      <header className="px-6 py-4 border-b border-border">
        <h2 className="text-lg font-semibold">{agent.name}</h2>
        {agent.instructions && <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">{agent.instructions}</p>}
      </header>

      <div className="px-6 py-4 border-b border-border flex items-end gap-2">
        <Textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={1} placeholder="Prompt for this run (optional)…" className="resize-none" />
        <Button className="gap-1.5" loading={runMutation.isPending} onClick={() => runMutation.mutate()}><Play className="h-4 w-4" /> Run</Button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-3">
        <h3 className="text-sm font-semibold">Runs</h3>
        {runsQuery.isLoading ? (
          <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-16 rounded-xl skeleton" />)}</div>
        ) : runs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No runs yet.</p>
        ) : runs.map((r) => (
          <RunRow key={r.id} run={r} expanded={activeRun === r.id} onToggle={() => setActiveRun(activeRun === r.id ? null : r.id)} />
        ))}
      </div>
    </div>
  )
}

function RunRow({ run, expanded, onToggle }: { run: AgentRunOut; expanded: boolean; onToggle: () => void }) {
  const status = describeRunStatus(run.status)
  const qc = useQueryClient()
  const cancelMutation = useMutation({
    mutationFn: () => getKroexClient().agents.cancelRun(run.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agent-runs', run.agent_id] }),
    onError: (e) => toast.error(getApiError(e)),
  })

  return (
    <div className="rounded-xl border border-border bg-card">
      <button onClick={onToggle} className="w-full flex items-center gap-3 px-4 py-3 text-left">
        <Cpu className="h-4 w-4 text-muted-foreground shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">Run {run.id.slice(0, 8)}</p>
          <p className="text-xs text-muted-foreground">{run.execution_mode} · {new Date(run.created_at).toLocaleString()}</p>
        </div>
        <Badge variant={status.variant} data-testid="run-status">{status.label}</Badge>
      </button>
      {expanded && <RunDetail run={run} onCancel={() => cancelMutation.mutate()} canceling={cancelMutation.isPending} />}
    </div>
  )
}

function RunDetail({ run, onCancel, canceling }: { run: AgentRunOut; onCancel: () => void; canceling: boolean }) {
  const [log, setLog] = useState<string[]>([])
  const [liveStatus, setLiveStatus] = useState(run.status)
  const abortRef = useRef<AbortController | null>(null)
  const status = describeRunStatus(liveStatus)

  // Patch (if the run produced one) — fetched from the sandbox surface.
  const patchQuery = useQuery({
    queryKey: ['patch', run.patch_id],
    queryFn: () => getKroexClient().sandbox.getPatch(run.patch_id as string),
    enabled: !!run.patch_id,
    retry: false,
  })
  const qc = useQueryClient()
  const applyMutation = useMutation({
    mutationFn: (id: string) => getKroexClient().sandbox.applyPatch(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['patch', run.patch_id] }); toast.success('Patch apply requested') },
    onError: (e) => toast.error(getApiError(e)),
  })
  const rejectMutation = useMutation({
    mutationFn: (id: string) => getKroexClient().sandbox.rejectPatch(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['patch', run.patch_id] }),
    onError: (e) => toast.error(getApiError(e)),
  })

  // Live events for in-progress runs (spec §2.3). Terminal runs are not streamed.
  useEffect(() => {
    if (isTerminalRunStatus(run.status)) return
    let cancelled = false
    abortRef.current = new AbortController()
    ;(async () => {
      try {
        const events = await agentRunEvents(run.id, abortRef.current!.signal)
        for await (const ev of events) {
          if (cancelled) break
          if (ev.type === 'run_status') setLiveStatus(ev.status)
          else if (ev.type === 'sandbox_step') setLog((l) => [...l, `$ ${ev.command}  →  ${ev.status}${ev.exit_code != null ? ` (exit ${ev.exit_code})` : ''}`])
          else if (ev.type === 'delta') setLog((l) => [...l, ev.text])
          else if (ev.type === 'done') setLiveStatus(ev.status)
          else if (ev.type === 'error') setLog((l) => [...l, `⚠ ${ev.message}`])
        }
      } catch { /* aborted or closed */ }
    })()
    return () => { cancelled = true; abortRef.current?.abort() }
  }, [run.id, run.status])

  return (
    <div className="border-t border-border p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Badge variant={status.variant}>{status.label}</Badge>
        {status.inProgress && (
          <Button size="sm" variant="outline" className="gap-1.5 text-destructive border-destructive/30" loading={canceling} onClick={onCancel}>
            <Square className="h-3 w-3" fill="currentColor" /> Cancel
          </Button>
        )}
        {run.error && <span className="text-xs text-destructive">{run.error}</span>}
      </div>

      {run.result_summary && <p className="text-sm">{run.result_summary}</p>}

      {log.length > 0 && (
        <pre className="max-h-48 overflow-auto rounded-lg bg-secondary/40 p-3 text-xs font-mono whitespace-pre-wrap" data-testid="run-log">{log.join('\n')}</pre>
      )}

      {run.patch_id && (
        patchQuery.isLoading ? <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading patch…</div>
        : patchQuery.data ? (
          <PatchCard patch={patchQuery.data} busy={applyMutation.isPending || rejectMutation.isPending}
            onApply={(id) => applyMutation.mutate(id)} onReject={(id) => rejectMutation.mutate(id)} />
        ) : null
      )}
    </div>
  )
}

function CreateAgentDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (v: boolean) => void; onCreated: (a: AgentOut) => void }) {
  const [name, setName] = useState('')
  const [instructions, setInstructions] = useState('')
  const [model, setModel] = useState<string>('kroex-pro')
  const mutation = useMutation({
    mutationFn: () => getKroexClient().agents.create({ name: name.trim(), instructions: instructions.trim(), model }),
    onSuccess: (a) => { setName(''); setInstructions(''); onCreated(a) },
    onError: (e) => toast.error(getApiError(e)),
  })
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>New agent</DialogTitle></DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); if (name.trim()) mutation.mutate() }} className="space-y-4 mt-2">
          <div><label className="text-sm font-medium mb-1.5 block">Name</label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Release notes writer" autoFocus required /></div>
          <div><label className="text-sm font-medium mb-1.5 block">Instructions</label><Textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} rows={3} placeholder="What should this agent do?" /></div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Model</label>
            <select value={model} onChange={(e) => setModel(e.target.value)} className="w-full h-10 rounded-xl border border-input bg-background px-3 text-sm">
              {KROEX_MODEL_IDS.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" loading={mutation.isPending} disabled={!name.trim()}>Create agent</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
