'use client'
import { useEffect, useRef, useState } from 'react'
import {
  buildPtyConnectionQuery, describePtyCloseCode, encodePingFrame, encodeResizeFrame,
  parsePtyServerControlFrame,
} from '@kroex/api'
import { Badge } from '@/components/ui/badge'

type ConnState = 'connecting' | 'connected' | 'reconnect' | 'closed'

/**
 * Interactive PTY terminal over the documented WebSocket contract (spec §3).
 *
 * Transport rules enforced here:
 *  - Shell bytes travel as BINARY frames in both directions. Keystrokes are
 *    sent as binary; server binary frames are written to the terminal.
 *  - Text frames are JSON control only (resize / ping out; hello / pong /
 *    closed / notice in).
 *  - Reconnect uses the hello frame's `handle` via ?attach=.
 *  - Close codes 4401/4404/4408/4409 are surfaced with their meaning.
 *
 * WS base: browsers cannot set headers on a WebSocket, so the JWT goes in the
 * `?token=` query param (spec §3.1). The socket targets the API origin
 * (NEXT_PUBLIC_API_URL) — the same-origin Next proxy does NOT upgrade
 * WebSockets, so a direct API WS URL (or a WS-capable proxy) is required.
 */
export function PtyTerminal({ sessionId }: { sessionId: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [state, setState] = useState<ConnState>('connecting')
  const [closeInfo, setCloseInfo] = useState<string | null>(null)
  const handleRef = useRef<string | null>(null)

  useEffect(() => {
    let term: import('@xterm/xterm').Terminal | null = null
    let fit: import('@xterm/addon-fit').FitAddon | null = null
    let ws: WebSocket | null = null
    let disposed = false
    let pingTimer: ReturnType<typeof setInterval> | null = null

    function wsBase(): string {
      const api = process.env.NEXT_PUBLIC_API_URL
      if (api) return api.replace(/^http/, 'ws')
      // Fallback: same-origin (note: Next proxy won't upgrade WS — needs a direct URL on staging).
      const { protocol, host } = window.location
      return `${protocol === 'https:' ? 'wss' : 'ws'}://${host}`
    }

    async function connect(attach?: string) {
      const [{ Terminal }, { FitAddon }] = await Promise.all([import('@xterm/xterm'), import('@xterm/addon-fit')])
      if (disposed) return
      if (!term) {
        term = new Terminal({ cursorBlink: true, fontFamily: 'var(--font-jetbrains, monospace)', fontSize: 13, theme: { background: '#141413' } })
        fit = new FitAddon()
        term.loadAddon(fit)
        if (containerRef.current) { term.open(containerRef.current); fit.fit() }
        // Keystrokes -> binary frames.
        term.onData((data) => {
          if (ws && ws.readyState === WebSocket.OPEN) ws.send(new TextEncoder().encode(data))
        })
      }

      const token = localStorage.getItem('kroex_token') ?? undefined
      const query = buildPtyConnectionQuery({ token, attach })
      ws = new WebSocket(`${wsBase()}/api/sandbox/sessions/${sessionId}/pty${query}`)
      ws.binaryType = 'arraybuffer'
      setState(attach ? 'reconnect' : 'connecting')

      ws.onopen = () => {
        setState('connected'); setCloseInfo(null)
        if (fit && term) { fit.fit(); ws?.send(encodeResizeFrame(term.cols, term.rows)) }
        pingTimer = setInterval(() => ws?.readyState === WebSocket.OPEN && ws.send(encodePingFrame()), 20_000)
      }
      ws.onmessage = (ev) => {
        if (ev.data instanceof ArrayBuffer) {
          term?.write(new Uint8Array(ev.data)) // server shell bytes
          return
        }
        const frame = parsePtyServerControlFrame(String(ev.data))
        if (!frame) return
        if (frame.type === 'session') handleRef.current = frame.handle
        else if (frame.type === 'notice') term?.writeln(`\r\n\x1b[33m[${frame.message}]\x1b[0m`)
        else if (frame.type === 'closed') term?.writeln('\r\n\x1b[90m[shell exited]\x1b[0m')
      }
      ws.onclose = (ev) => {
        if (pingTimer) clearInterval(pingTimer)
        if (disposed) return
        // 4408 idle-timeout: the shell may still be attachable within the window.
        if (ev.code === 4408 && handleRef.current) {
          setState('reconnect')
          setTimeout(() => !disposed && connect(handleRef.current ?? undefined), 500)
          return
        }
        setState('closed')
        setCloseInfo(ev.code >= 4401 && ev.code <= 4409 ? describePtyCloseCode(ev.code) : `Connection closed (${ev.code})`)
      }
      ws.onerror = () => { /* onclose carries the detail */ }
    }

    connect()
    const onResize = () => { if (fit && term && ws?.readyState === WebSocket.OPEN) { fit.fit(); ws.send(encodeResizeFrame(term.cols, term.rows)) } }
    window.addEventListener('resize', onResize)

    return () => {
      disposed = true
      window.removeEventListener('resize', onResize)
      if (pingTimer) clearInterval(pingTimer)
      ws?.close()
      term?.dispose()
    }
  }, [sessionId])

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border">
        <span className="text-xs font-medium">Terminal</span>
        {state === 'connecting' && <Badge variant="warning">Connecting…</Badge>}
        {state === 'connected' && <Badge variant="success">Connected</Badge>}
        {state === 'reconnect' && <Badge variant="warning">Reconnecting…</Badge>}
        {state === 'closed' && <Badge variant="muted">Closed</Badge>}
        {closeInfo && <span className="text-xs text-muted-foreground truncate">{closeInfo}</span>}
      </div>
      <div ref={containerRef} className="flex-1 min-h-[280px] bg-[#141413] p-2 overflow-hidden" data-testid="pty-container" />
    </div>
  )
}
