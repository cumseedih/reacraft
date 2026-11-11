/**
 * Parser for the "named" SSE dialect used ONLY by sandbox command events
 * (spec §2.4): frames carry `id:` (output events only), `event: <name>`,
 * and `data: {json}` lines. Resume is sequence-based via `after_seq` /
 * `Last-Event-ID`. Do NOT reuse the unnamed-dialect parser here — the two
 * are deliberately separate (spec §9.1).
 */

export interface SandboxOutputEvent {
  event: 'output'
  seq: number
  stream: 'stdout' | 'stderr' | 'pty'
  data: string
}

export interface SandboxExitEvent {
  event: 'exit'
  status: string
  exit_code: number | null
  duration_ms: number | null
  bytes_out: number
  output_truncated: boolean
}

export interface SandboxHeartbeatEvent {
  event: 'heartbeat'
  seq: number
}

export interface SandboxCommandErrorEvent {
  event: 'error'
  detail: string
}

export type SandboxCommandEvent =
  | SandboxOutputEvent
  | SandboxExitEvent
  | SandboxHeartbeatEvent
  | SandboxCommandErrorEvent

function stripFieldPrefix(line: string, field: string): string | null {
  const prefix = field + ':'
  if (!line.startsWith(prefix)) return null
  let value = line.slice(prefix.length)
  if (value.startsWith(' ')) value = value.slice(1)
  return value
}

export interface NamedSseParseOptions {
  onParseError?: (rawFrame: string, error: unknown) => void
}

/**
 * Stateful frame buffer for the named dialect. Like UnnamedSseParser, this
 * buffers partial frames across feed() calls so network chunk boundaries
 * never corrupt JSON parsing.
 */
export class NamedSseParser {
  private buffer = ''
  private readonly onParseError?: (rawFrame: string, error: unknown) => void

  constructor(options: NamedSseParseOptions = {}) {
    this.onParseError = options.onParseError
  }

  feed(chunk: string): SandboxCommandEvent[] {
    this.buffer += chunk.replace(/\r\n/g, '\n')
    const frames = this.buffer.split('\n\n')
    this.buffer = frames.pop() ?? ''

    const events: SandboxCommandEvent[] = []
    for (const frame of frames) {
      if (frame.trim() === '') continue
      let eventName: string | null = null
      const dataLines: string[] = []
      for (const line of frame.split('\n')) {
        const ev = stripFieldPrefix(line, 'event')
        if (ev !== null) {
          eventName = ev
          continue
        }
        const data = stripFieldPrefix(line, 'data')
        if (data !== null) {
          dataLines.push(data)
          continue
        }
        // `id:` lines are present on output frames but are redundant with
        // the JSON body's own `seq` field (spec §2.4) — intentionally not
        // parsed separately here; use SandboxEventCursor.update(seq) from
        // the parsed `output`/`heartbeat` event instead.
      }
      if (!eventName || dataLines.length === 0) {
        this.onParseError?.(frame, new Error('named SSE frame missing event: or data: line'))
        continue
      }
      try {
        const body = JSON.parse(dataLines.join('\n')) as Record<string, unknown>
        events.push({ event: eventName, ...body } as SandboxCommandEvent)
      } catch (error) {
        this.onParseError?.(frame, error)
      }
    }
    return events
  }
}

export async function* iterateNamedSse(
  textChunks: AsyncIterable<string>,
  options: NamedSseParseOptions = {},
): AsyncGenerator<SandboxCommandEvent> {
  const parser = new NamedSseParser(options)
  for await (const chunk of textChunks) {
    for (const event of parser.feed(chunk)) yield event
  }
}

/**
 * Tracks the highest `seq` seen so a dropped connection can resume without
 * loss or duplication (spec §2.4 resume contract: server uses
 * max(after_seq, Last-Event-ID), both accepted).
 */
export class SandboxEventCursor {
  private lastSeq = 0

  /** Call with every output/heartbeat event's `seq`. */
  observe(seq: number): void {
    if (seq > this.lastSeq) this.lastSeq = seq
  }

  get afterSeq(): number {
    return this.lastSeq
  }

  /** Query param + header to send on reconnect — send both; the server takes the max (harmless redundancy, matches spec wording exactly). */
  reconnectParams(): { query: string; headers: Record<string, string> } {
    return {
      query: `after_seq=${this.lastSeq}`,
      headers: { 'Last-Event-ID': String(this.lastSeq) },
    }
  }
}

/**
 * True when the stream ended because of the server's own idle-timeout
 * heartbeat-close (~240 polls / 2 min, spec §2.4) rather than a real error —
 * callers should treat this as "reconnect", not "failed".
 */
export function isSandboxHeartbeatEvent(event: SandboxCommandEvent): event is SandboxHeartbeatEvent {
  return event.event === 'heartbeat'
}

export function isSandboxExitEvent(event: SandboxCommandEvent): event is SandboxExitEvent {
  return event.event === 'exit'
}
