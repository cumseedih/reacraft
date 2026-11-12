/**
 * PTY WebSocket protocol types + frame helpers.
 * Source: API Integration Specification §3 (WS /api/sandbox/sessions/{id}/pty).
 *
 * CRITICAL per spec §3.3 / §9 guidance #7: terminal bytes travel in BINARY
 * frames in both directions. Text frames are JSON control only. Sending
 * shell input as a text frame silently does nothing (observed in Phase-2
 * acceptance). This module defines the control-frame shapes and close-code
 * meanings; it intentionally does NOT include a WebSocket implementation —
 * each platform's adapter (web native WebSocket, Tauri Rust-side, mobile)
 * supplies the actual socket and uses these types + helpers.
 */

/** First frame the server sends on a successful connection (always text/JSON). */
export interface PtyHelloFrame {
  type: 'session'
  /** Reconnect key: pass as ?attach=<handle> to resume the SAME shell within the idle window. */
  handle: string
  session_id: string
}

export interface PtyResizeFrame {
  type: 'resize'
  /** Defaults to 80 server-side if omitted. */
  cols?: number
  /** Defaults to 24 server-side if omitted. */
  rows?: number
}

export interface PtyPingFrame {
  type: 'ping'
}

export interface PtyPongFrame {
  type: 'pong'
}

/** The shell process exited; the server then finalises the PTY (command row + audit). */
export interface PtyClosedFrame {
  type: 'closed'
}

/** Backpressure notice: a downstream frame exceeded sandbox_pty_max_buffer_bytes (default 256 KiB) and was dropped, OR a client send blocked > 2s ("too slow"). */
export interface PtyNoticeFrame {
  type: 'notice'
  message: string
}

/** Client -> server text/JSON control frames. */
export type PtyClientControlFrame = PtyResizeFrame | PtyPingFrame

/** Server -> client text/JSON control frames (hello is sent exactly once, always first). */
export type PtyServerControlFrame = PtyHelloFrame | PtyPongFrame | PtyClosedFrame | PtyNoticeFrame

/** WebSocket close codes this endpoint defines (spec §3.2). Standard codes (1000, 1006, ...) may also occur from ordinary network conditions. */
export const PTY_CLOSE_CODES = {
  UNAUTHENTICATED: 4401,
  UNKNOWN_NOT_OWNED_OR_DISABLED: 4404,
  IDLE_TIMEOUT: 4408,
  SESSION_NOT_LIVE: 4409,
} as const

export type PtyCloseCode = (typeof PTY_CLOSE_CODES)[keyof typeof PTY_CLOSE_CODES]

export const PTY_CLOSE_CODE_MEANINGS: Record<number, string> = {
  [PTY_CLOSE_CODES.UNAUTHENTICATED]: 'No/invalid token, or user not found.',
  [PTY_CLOSE_CODES.UNKNOWN_NOT_OWNED_OR_DISABLED]:
    'Flags off; session missing; session owned by another user; or ?attach= handle unknown / belongs to a different session.',
  [PTY_CLOSE_CODES.IDLE_TIMEOUT]: 'No activity for sandbox_pty_idle_seconds (default 300s) — server closed the PTY, then the socket.',
  [PTY_CLOSE_CODES.SESSION_NOT_LIVE]: 'Session state is not running/idle, or opening a new PTY failed.',
}

export function describePtyCloseCode(code: number): string {
  return PTY_CLOSE_CODE_MEANINGS[code] ?? `Unrecognized close code ${code} (standard WebSocket code, not PTY-specific).`
}

/** Builds the connection query string. Auth also accepts the Authorization header where the client can set one (native clients); browsers must use the query param since they cannot set WS headers. */
export function buildPtyConnectionQuery(params: { token?: string; attach?: string }): string {
  const search = new URLSearchParams()
  if (params.token) search.set('token', params.token)
  if (params.attach) search.set('attach', params.attach)
  const qs = search.toString()
  return qs ? `?${qs}` : ''
}

/** Type guard + parser for server text/JSON control frames. Returns null for unrecognized/malformed text (caller should ignore, per spec: "unparseable text frames are ignored" — that rule is stated for frames the SERVER receives, but is the safe default here too). */
export function parsePtyServerControlFrame(text: string): PtyServerControlFrame | null {
  try {
    const parsed = JSON.parse(text) as { type?: unknown }
    if (parsed && typeof parsed.type === 'string') {
      if (['session', 'pong', 'closed', 'notice'].includes(parsed.type)) {
        return parsed as PtyServerControlFrame
      }
    }
    return null
  } catch {
    return null
  }
}

export function encodeResizeFrame(cols: number, rows: number): string {
  return JSON.stringify({ type: 'resize', cols, rows } satisfies PtyResizeFrame)
}

export function encodePingFrame(): string {
  return JSON.stringify({ type: 'ping' } satisfies PtyPingFrame)
}
