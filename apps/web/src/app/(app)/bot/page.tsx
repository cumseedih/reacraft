'use client'
import { useRef, useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Bot, Send, AlertCircle, Loader2, Zap } from 'lucide-react'
import { toast } from 'sonner'
import { AppShell } from '@/components/app-shell'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ActionCard } from '@/components/bot/action-card'
import { getKroexClient } from '@/lib/kroex-client'
import { botStreamEvents, getApiError } from '@/lib/api'
import { KroexApiError } from '@kroex/api'
import type { BotActionOut } from '@kroex/api'

interface Msg { id: string; role: 'user' | 'assistant'; content: string; streaming?: boolean }
const genId = () => Math.random().toString(36).slice(2)

export default function BotPage() {
  const qc = useQueryClient()
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  // getConversation doubles as the "is BOT enabled?" probe — a flag-off
  // backend returns 404 (overloaded, spec §5.3), surfaced as a clear state.
  const convQuery = useQuery({
    queryKey: ['bot-conversation'],
    queryFn: () => getKroexClient().bot.getConversation(),
    retry: false,
  })

  const actionsQuery = useQuery({
    queryKey: ['bot-actions'],
    queryFn: () => getKroexClient().bot.listActions(undefined, 50),
    enabled: !convQuery.isError,
    retry: false,
  })

  const confirmMutation = useMutation({
    mutationFn: (id: string) => getKroexClient().bot.confirmAction(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bot-actions'] }),
    onError: (e) => toast.error(getApiError(e)),
  })
  const rejectMutation = useMutation({
    mutationFn: (id: string) => getKroexClient().bot.rejectAction(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bot-actions'] }),
    onError: (e) => toast.error(getApiError(e)),
  })

  const send = useCallback(async () => {
    const text = input.trim()
    if (!text || streaming) return
    setInput(''); setStreaming(true)
    const asstId = genId()
    setMessages((prev) => [...prev, { id: genId(), role: 'user', content: text }, { id: asstId, role: 'assistant', content: '', streaming: true }])
    abortRef.current = new AbortController()
    try {
      const { events } = await botStreamEvents({ message: text }, abortRef.current.signal)
      for await (const ev of events) {
        if (ev.type === 'delta') {
          setMessages((prev) => prev.map((m) => m.id === asstId ? { ...m, content: m.content + ev.text } : m))
        } else if (ev.type === 'action' || ev.type === 'action_result') {
          // A proposal or an executed result changed server-side action state.
          qc.invalidateQueries({ queryKey: ['bot-actions'] })
        } else if (ev.type === 'done') {
          setMessages((prev) => prev.map((m) => m.id === asstId ? { ...m, streaming: false } : m))
        } else if (ev.type === 'error') {
          throw new Error(ev.message)
        }
      }
    } catch (e) {
      if ((e as Error).name !== 'AbortError') {
        setMessages((prev) => prev.map((m) => m.id === asstId ? { ...m, streaming: false, content: m.content || '(failed)' } : m))
        toast.error(getApiError(e))
      }
    } finally {
      setStreaming(false); abortRef.current = null
      qc.invalidateQueries({ queryKey: ['bot-actions'] })
    }
  }, [input, streaming, qc])

  // BOT disabled on this backend.
  if (convQuery.isError && convQuery.error instanceof KroexApiError && convQuery.error.status === 404) {
    return (
      <AppShell>
        <div className="flex h-full flex-col items-center justify-center text-center p-8">
          <div className="h-14 w-14 rounded-2xl bg-secondary flex items-center justify-center mb-4"><Bot className="h-7 w-7 text-muted-foreground" /></div>
          <h1 className="text-lg font-semibold">BOT is not enabled</h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm">
            This backend does not have the BOT feature turned on. It is available on environments where <code className="text-xs">BOT_ENABLED</code> is set.
          </p>
        </div>
      </AppShell>
    )
  }

  const actions = actionsQuery.data ?? []
  const busy = confirmMutation.isPending || rejectMutation.isPending

  return (
    <AppShell>
      <div className="flex h-full overflow-hidden">
        {/* Conversation */}
        <div className="flex flex-col flex-1 min-w-0 border-r border-border">
          <header className="flex items-center gap-2 px-6 py-4 border-b border-border">
            <Bot className="h-5 w-5 text-primary" />
            <div>
              <h1 className="text-base font-semibold">KROEX Bot</h1>
              <p className="text-xs text-muted-foreground">Ask the bot to act on your projects, memories and sandboxes.</p>
            </div>
          </header>
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {convQuery.isLoading ? (
              <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : messages.length === 0 ? (
              <div className="text-center py-16 text-sm text-muted-foreground">Send a message to get started. Proposed actions appear on the right for your approval.</div>
            ) : messages.map((m) => (
              <div key={m.id} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
                <div className={m.role === 'user' ? 'bg-primary text-primary-foreground rounded-2xl rounded-tr-sm px-4 py-2.5 max-w-[80%]' : 'bg-secondary rounded-2xl rounded-tl-sm px-4 py-2.5 max-w-[80%]'}>
                  <p className="text-sm whitespace-pre-wrap">{m.content}{m.streaming ? ' ▋' : ''}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="p-4 border-t border-border flex items-end gap-2">
            <Textarea value={input} onChange={(e) => setInput(e.target.value)} rows={1} placeholder="Message the bot…"
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }} className="resize-none" />
            <Button onClick={send} disabled={!input.trim() || streaming} size="icon" aria-label="Send"><Send className="h-4 w-4" /></Button>
          </div>
        </div>

        {/* Actions */}
        <aside className="w-[360px] shrink-0 flex flex-col hidden lg:flex">
          <header className="flex items-center gap-2 px-5 py-4 border-b border-border">
            <Zap className="h-4 w-4 text-primary" /><h2 className="text-sm font-semibold">Actions</h2>
          </header>
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {actionsQuery.isLoading ? (
              <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-20 rounded-xl skeleton" />)}</div>
            ) : actionsQuery.isError ? (
              <div className="text-center py-10"><AlertCircle className="h-7 w-7 text-destructive mx-auto mb-2" /><p className="text-sm text-muted-foreground">{getApiError(actionsQuery.error)}</p></div>
            ) : actions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-10">No actions yet. The bot proposes actions as it works.</p>
            ) : actions.map((a: BotActionOut) => (
              <ActionCard key={a.id} action={a} busy={busy} onConfirm={(id) => confirmMutation.mutate(id)} onReject={(id) => rejectMutation.mutate(id)} />
            ))}
          </div>
        </aside>
      </div>
    </AppShell>
  )
}
