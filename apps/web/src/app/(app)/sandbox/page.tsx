'use client'
import { useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Server, Plus, Play, Square, Trash2, Camera, AlertCircle, Loader2, RotateCcw,
} from 'lucide-react'
import { toast } from 'sonner'
import { AppShell } from '@/components/app-shell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { describeSessionState, describeRestoreState } from '@/lib/sandbox'
import { streamCommandEvents } from '@/lib/sandbox-stream'
import { getKroexClient } from '@/lib/kroex-client'
import { getApiError } from '@/lib/api'
import {
  KroexApiError, filterBuiltSandboxImages, isRestoreInProgress, isSandboxSessionLive,
  type SessionOut, type SnapshotOut,
} from '@kroex/api'
import { cn } from '@/lib/utils'

const PtyTerminal = dynamic(() => import('@/components/sandbox/pty-terminal').then((m) => m.PtyTerminal), { ssr: false })

export default function SandboxPage() {
  const qc = useQueryClient()
  const [selected, setSelected] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)

  const configQuery = useQuery({ queryKey: ['sandbox-config'], queryFn: () => getKroexClient().sandbox.getConfig(), retry: false })
  const sessionsQuery = useQuery({
    queryKey: ['sandbox-sessions'], queryFn: () => getKroexClient().sandbox.listSessions(),
    enabled: !configQuery.isError, retry: false, refetchInterval: 5000,
  })

  if (configQuery.isError && configQuery.error instanceof KroexApiError && configQuery.error.status === 404) {
    return (
      <AppShell>
        <div className="flex h-full flex-col items-center justify-center text-center p-8">
          <div className="h-14 w-14 rounded-2xl bg-secondary flex items-center justify-center mb-4"><Server className="h-7 w-7 text-muted-foreground" /></div>
          <h1 className="text-lg font-semibold">Sandbox is not enabled</h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm">This backend does not have the Sandbox feature turned on (<code className="text-xs">SANDBOX_ENABLED</code>).</p>
        </div>
      </AppShell>
    )
  }

  const sessions = sessionsQuery.data ?? []
  const current = sessions.find((s) => s.id === selected) ?? null
  const builtImages = filterBuiltSandboxImages(configQuery.data?.images ?? [])

  return (
    <AppShell>
      <div className="flex h-full overflow-hidden">
        <div className="w-80 shrink-0 border-r border-border flex flex-col">
          <header className="flex items-center justify-between px-4 py-4 border-b border-border">
            <div>
              <h1 className="text-base font-semibold">Sandbox</h1>
              {configQuery.data && <p className="text-xs text-muted-foreground">runtime: {configQuery.data.runtime} · images: {builtImages.join(', ')}</p>}
            </div>
            <Button size="icon-sm" onClick={() => setCreateOpen(true)} aria-label="New session"><Plus className="h-4 w-4" /></Button>
          </header>

          {configQuery.data?.limits && Object.keys(configQuery.data.limits).length > 0 && (
            <div className="px-4 py-2 border-b border-border">
              <p className="text-xs font-semibold text-muted-foreground mb-1">Plan limits</p>
              <div className="flex flex-wrap gap-1">
                {Object.entries(configQuery.data.limits).slice(0, 6).map(([k, v]) => (
                  <Badge key={k} variant="muted" className="text-[10px]">{k.replace('sandbox_', '')}: {v}</Badge>
                ))}
              </div>
            </div>
          )}

          <div className="flex-1 overflow-y-auto p-2">
            {sessionsQuery.isLoading ? (
              <div className="space-y-2 p-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-14 rounded-xl skeleton" />)}</div>
            ) : sessionsQuery.isError ? (
              <div className="text-center py-8 px-3"><AlertCircle className="h-7 w-7 text-destructive mx-auto mb-2" /><p className="text-sm text-muted-foreground">{getApiError(sessionsQuery.error)}</p></div>
            ) : sessions.length === 0 ? (
              <div className="text-center py-10 px-3"><p className="text-sm text-muted-foreground">No sessions</p><Button size="sm" className="mt-3 gap-1.5" onClick={() => setCreateOpen(true)}><Plus className="h-3.5 w-3.5" /> New session</Button></div>
            ) : sessions.map((s) => {
              const st = describeSessionState(s.state)
              return (
                <button key={s.id} onClick={() => setSelected(s.id)} className={cn('w-full text-left rounded-xl px-3 py-2.5 transition-colors', current?.id === s.id ? 'bg-secondary' : 'hover:bg-muted/60')}>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium truncate">{s.image} · {s.id.slice(0, 8)}</p>
                    <Badge variant={st.variant} data-testid="session-state">{st.label}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{s.network_policy} · cpu {s.cpu_seconds}s</p>
                </button>
              )
            })}
          </div>
        </div>

        <div className="flex-1 min-w-0">
          {current ? <SessionDetail session={current} /> : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Select or create a session.</div>
          )}
        </div>
      </div>

      <CreateSessionDialog open={createOpen} onOpenChange={setCreateOpen} images={builtImages}
        onCreated={(s) => { qc.invalidateQueries({ queryKey: ['sandbox-sessions'] }); setSelected(s.id); setCreateOpen(false) }} />
    </AppShell>
  )
}

function SessionDetail({ session }: { session: SessionOut }) {
  const qc = useQueryClient()
  const [tab, setTab] = useState<'command' | 'terminal' | 'snapshots'>('command')
  const st = describeSessionState(session.state)
  const live = isSandboxSessionLive(session.state)

  const invalidate = () => qc.invalidateQueries({ queryKey: ['sandbox-sessions'] })
  const stop = useMutation({ mutationFn: () => getKroexClient().sandbox.stopSession(session.id), onSuccess: invalidate, onError: (e) => toast.error(getApiError(e)) })
  const resume = useMutation({ mutationFn: () => getKroexClient().sandbox.resumeSession(session.id), onSuccess: invalidate, onError: (e) => toast.error(getApiError(e)) })
  const destroy = useMutation({ mutationFn: () => getKroexClient().sandbox.destroySession(session.id), onSuccess: invalidate, onError: (e) => toast.error(getApiError(e)) })

  // Resume must be blocked while a snapshot restore is in progress.
  const snapsQuery = useQuery({ queryKey: ['snapshots', session.workspace_id], queryFn: () => getKroexClient().sandbox.listSnapshots(session.workspace_id), retry: false })
  const restoreInFlight = (snapsQuery.data ?? []).some((s) => isRestoreInProgress(s.restore_state))

  return (
    <div className="flex flex-col h-full">
      <header className="px-6 py-4 border-b border-border flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2"><h2 className="text-base font-semibold truncate">{session.image} · {session.id.slice(0, 12)}</h2><Badge variant={st.variant}>{st.label}</Badge></div>
          <p className="text-xs text-muted-foreground mt-0.5">workspace {session.workspace_id.slice(0, 8)} · {session.network_policy} · peak mem {session.peak_memory_mb}MB</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {live ? (
            <Button size="sm" variant="outline" className="gap-1.5" loading={stop.isPending} onClick={() => stop.mutate()}><Square className="h-3.5 w-3.5" /> Stop</Button>
          ) : (
            <Button size="sm" variant="outline" className="gap-1.5" loading={resume.isPending} disabled={restoreInFlight} title={restoreInFlight ? 'A snapshot restore is in progress' : undefined} onClick={() => resume.mutate()}><Play className="h-3.5 w-3.5" /> Resume</Button>
          )}
          <Button size="sm" variant="outline" className="gap-1.5 text-destructive border-destructive/30" loading={destroy.isPending} onClick={() => destroy.mutate()}><Trash2 className="h-3.5 w-3.5" /> Destroy</Button>
        </div>
      </header>

      <div className="px-6 border-b border-border flex gap-1">
        {([['command', 'Command'], ['terminal', 'Terminal'], ['snapshots', 'Snapshots']] as const).map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)} className={cn('px-3 py-2.5 text-sm border-b-2 transition-colors', tab === k ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground')}>{label}</button>
        ))}
      </div>

      <div className="flex-1 overflow-hidden">
        {tab === 'command' && <CommandRunner session={session} disabled={!live} />}
        {tab === 'terminal' && (live ? <PtyTerminal sessionId={session.id} /> : <Disabled text="Session must be running or idle to open a terminal." />)}
        {tab === 'snapshots' && <Snapshots workspaceId={session.workspace_id} snapshots={snapsQuery.data ?? []} loading={snapsQuery.isLoading} />}
      </div>
    </div>
  )
}

function Disabled({ text }: { text: string }) {
  return <div className="flex h-full items-center justify-center text-sm text-muted-foreground p-8 text-center">{text}</div>
}

function CommandRunner({ session, disabled }: { session: SessionOut; disabled: boolean }) {
  const [cmd, setCmd] = useState('')
  const [output, setOutput] = useState('')
  const [status, setStatus] = useState<string | null>(null)
  const [running, setRunning] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const run = async () => {
    const command = cmd.trim()
    if (!command || disabled || running) return
    setOutput(''); setStatus(null); setRunning(true)
    try {
      const created = await getKroexClient().sandbox.createCommand(session.id, { command })
      abortRef.current = new AbortController()
      await streamCommandEvents(created.id, (ev) => {
        if (ev.event === 'output') setOutput((o) => o + ev.data)        // reassemble in order (spec §9.2)
        else if (ev.event === 'exit') setStatus(`${ev.status} (exit ${ev.exit_code ?? '—'}, ${ev.bytes_out} bytes${ev.output_truncated ? ', truncated' : ''})`)
        else if (ev.event === 'error') setStatus(`error: ${ev.detail}`)
        // heartbeat: reconnect handled by the shared driver
      }, abortRef.current.signal)
    } catch (e) {
      setStatus(`error: ${getApiError(e)}`)
    } finally {
      setRunning(false); abortRef.current = null
    }
  }

  return (
    <div className="flex flex-col h-full p-6 gap-3">
      <div className="flex gap-2">
        <Input value={cmd} onChange={(e) => setCmd(e.target.value)} placeholder="e.g. python -c 'print(2+2)'" disabled={disabled}
          onKeyDown={(e) => { if (e.key === 'Enter') run() }} className="font-mono text-sm" />
        <Button className="gap-1.5" disabled={disabled || running || !cmd.trim()} onClick={run} loading={running}><Play className="h-4 w-4" /> Run</Button>
      </div>
      {disabled && <p className="text-xs text-muted-foreground">Session must be running or idle to run commands.</p>}
      <pre className="flex-1 overflow-auto rounded-xl bg-[#141413] text-[#e8e6dc] p-4 text-xs font-mono whitespace-pre-wrap" data-testid="command-output">{output || (running ? 'running…' : 'Output will appear here.')}</pre>
      {status && <p className="text-xs text-muted-foreground" data-testid="command-status">Status: {status}</p>}
    </div>
  )
}

function Snapshots({ workspaceId, snapshots, loading }: { workspaceId: string; snapshots: SnapshotOut[]; loading: boolean }) {
  const qc = useQueryClient()
  const invalidate = () => qc.invalidateQueries({ queryKey: ['snapshots', workspaceId] })
  const create = useMutation({ mutationFn: () => getKroexClient().sandbox.createSnapshot(workspaceId), onSuccess: () => { invalidate(); toast.success('Snapshot requested') }, onError: (e) => toast.error(getApiError(e)) })
  const restore = useMutation({ mutationFn: (id: string) => getKroexClient().sandbox.restoreSnapshot(id), onSuccess: () => { invalidate(); toast.success('Restore requested') }, onError: (e) => toast.error(getApiError(e)) })

  return (
    <div className="flex flex-col h-full p-6 gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Snapshots</h3>
        <Button size="sm" variant="outline" className="gap-1.5" loading={create.isPending} onClick={() => create.mutate()}><Camera className="h-3.5 w-3.5" /> Create snapshot</Button>
      </div>
      {loading ? (
        <div className="space-y-2">{Array.from({ length: 2 }).map((_, i) => <div key={i} className="h-14 rounded-xl skeleton" />)}</div>
      ) : snapshots.length === 0 ? (
        <p className="text-sm text-muted-foreground">No snapshots yet.</p>
      ) : (
        <ul className="space-y-2">
          {snapshots.map((s) => {
            const rs = describeRestoreState(s.restore_state)
            return (
              <li key={s.id} className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
                <Camera className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{s.id.slice(0, 12)}</p>
                  <p className="text-xs text-muted-foreground">{s.kind} · {(s.size_bytes / 1024).toFixed(0)} KB</p>
                  {s.restore_error && <p className="text-xs text-destructive mt-0.5">{s.restore_error}</p>}
                </div>
                {s.restore_state && s.restore_state !== 'idle' && <Badge variant={rs.variant} data-testid="restore-state">{rs.label}</Badge>}
                <Button size="sm" variant="outline" className="gap-1.5" disabled={rs.inProgress || restore.isPending}
                  title={rs.inProgress ? 'Restore already in progress' : undefined} onClick={() => restore.mutate(s.id)}>
                  {rs.inProgress ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />} Restore
                </Button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function CreateSessionDialog({ open, onOpenChange, images, onCreated }: { open: boolean; onOpenChange: (v: boolean) => void; images: string[]; onCreated: (s: SessionOut) => void }) {
  const [workspaceName, setWorkspaceName] = useState('')
  const [image, setImage] = useState(images[0] ?? 'python')
  const [proxy, setProxy] = useState(false)

  const mutation = useMutation({
    mutationFn: async () => {
      // A session needs a workspace; create one for this session.
      const ws = await getKroexClient().sandbox.createWorkspace({ name: workspaceName.trim() || `ws-${Date.now()}` })
      return getKroexClient().sandbox.createSession({ workspace_id: ws.id, image, network_policy: proxy ? 'proxy' : 'none' })
    },
    onSuccess: onCreated,
    onError: (e) => toast.error(getApiError(e)),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>New sandbox session</DialogTitle><DialogDescription>Runs under gVisor (runsc) with your plan limits.</DialogDescription></DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); mutation.mutate() }} className="space-y-4 mt-2">
          <div><label className="text-sm font-medium mb-1.5 block">Workspace name</label><Input value={workspaceName} onChange={(e) => setWorkspaceName(e.target.value)} placeholder="optional" /></div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Image</label>
            <select value={image} onChange={(e) => setImage(e.target.value)} className="w-full h-10 rounded-xl border border-input bg-background px-3 text-sm">
              {images.map((img) => <option key={img} value={img}>{img}</option>)}
            </select>
            <p className="text-xs text-muted-foreground mt-1">Only built images are listed (the unbuilt &ldquo;full&rdquo; image is excluded).</p>
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={proxy} onChange={(e) => setProxy(e.target.checked)} /> Enable egress proxy (requires an active grant)</label>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" loading={mutation.isPending}>Create session</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
