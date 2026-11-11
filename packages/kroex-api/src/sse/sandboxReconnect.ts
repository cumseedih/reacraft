import { NamedSseParser, SandboxEventCursor, isSandboxExitEvent, type SandboxCommandEvent } from './named.js'

/**
 * Transport injection point: opens ONE streaming HTTP connection to
 * GET /api/sandbox/commands/{id}/events with the given resume params and
 * yields decoded text chunks until the server ends the response (either a
 * terminal `exit` frame, or the ~240-poll/2-min heartbeat-close — spec
 * §2.4). Kept out of this package so web/mobile/desktop each use their own
 * fetch/stream primitive; this driver only needs the resulting text.
 */
export interface SandboxEventsTransport {
  openStream(
    params: { query: string; headers: Record<string, string> },
    signal: AbortSignal,
  ): AsyncIterable<string>
}

export interface SandboxReconnectOptions {
  signal?: AbortSignal
  /** Safety cap on automatic reconnects (default: unlimited — the server-side heartbeat is the only natural end short of a real exit). */
  maxReconnects?: number
  onParseError?: (rawFrame: string, error: unknown) => void
  /** Called each time a new connection is opened (including the first), with the after_seq it resumes from. Useful for logging/telemetry. */
  onReconnect?: (afterSeq: number, attempt: number) => void
}

/**
 * Drives GET /api/sandbox/commands/{id}/events end-to-end: parses the named
 * dialect, tracks the resume cursor, and automatically reconnects (with
 * after_seq / Last-Event-ID) whenever the server closes the stream without
 * a terminal `exit` event (i.e. the 240-poll heartbeat timeout, spec §2.4) —
 * this is documented, expected behaviour, not a failure. Stops yielding
 * once a real `exit` event is observed, or the caller's AbortSignal fires.
 */
export async function* streamSandboxCommandEvents(
  transport: SandboxEventsTransport,
  options: SandboxReconnectOptions = {},
): AsyncGenerator<SandboxCommandEvent> {
  const cursor = new SandboxEventCursor()
  const maxReconnects = options.maxReconnects ?? Number.POSITIVE_INFINITY
  const signal = options.signal ?? new AbortController().signal

  let attempt = 0
  while (true) {
    if (signal.aborted) return
    options.onReconnect?.(cursor.afterSeq, attempt)
    const parser = new NamedSseParser({ onParseError: options.onParseError })
    let sawExit = false

    for await (const chunk of transport.openStream(cursor.reconnectParams(), signal)) {
      for (const event of parser.feed(chunk)) {
        if ('seq' in event) cursor.observe(event.seq)
        yield event
        if (isSandboxExitEvent(event)) sawExit = true
      }
      if (sawExit) return
    }

    if (sawExit) return
    attempt += 1
    if (attempt > maxReconnects) return
    // else: the connection ended without a terminal exit (heartbeat timeout,
    // or a dropped connection) — loop around and reconnect from the cursor.
  }
}
