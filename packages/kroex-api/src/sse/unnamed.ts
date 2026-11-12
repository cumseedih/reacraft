/**
 * Parser for the "unnamed" SSE dialect: every frame is exactly
 * `data: {json}\n\n` with NO `event:` line; the JSON's `type` field
 * discriminates it. Used by chat, bot, and agent-run streams (spec §2.1-2.3).
 *
 * Do NOT share this parser with the sandbox command dialect (§2.4) — that
 * one uses named events (`event:`/`id:` lines). See sse/named.ts.
 */

/** Strips a leading "data:" (and at most one following space) per the SSE spec. */
function stripFieldPrefix(line: string, field: string): string | null {
  if (line === field) return ''
  const prefix = field + ':'
  if (!line.startsWith(prefix)) return null
  let value = line.slice(prefix.length)
  if (value.startsWith(' ')) value = value.slice(1)
  return value
}

export interface UnnamedSseParseOptions {
  /** Called for a frame that failed to parse as JSON or had no `data:` line. Defaults to silently skipping (matches the pattern already used in apps/web and apps/mobile). */
  onParseError?: (rawFrame: string, error: unknown) => void
}

/**
 * Stateful frame buffer for the unnamed dialect. Feed it raw text chunks as
 * they arrive over the wire (network chunk boundaries do NOT need to align
 * with SSE frame boundaries — this buffers partial frames across calls).
 */
export class UnnamedSseParser<TEvent extends { type: string }> {
  private buffer = ''
  private readonly onParseError?: (rawFrame: string, error: unknown) => void

  constructor(options: UnnamedSseParseOptions = {}) {
    this.onParseError = options.onParseError
  }

  /** Feed a decoded text chunk; returns zero or more fully-parsed events extracted from it. */
  feed(chunk: string): TEvent[] {
    this.buffer += chunk.replace(/\r\n/g, '\n')
    const frames = this.buffer.split('\n\n')
    // The last element is either empty (buffer ended exactly on a frame
    // boundary) or a partial frame still awaiting more data — keep it.
    this.buffer = frames.pop() ?? ''

    const events: TEvent[] = []
    for (const frame of frames) {
      if (frame.trim() === '') continue
      const dataLines: string[] = []
      for (const line of frame.split('\n')) {
        const data = stripFieldPrefix(line, 'data')
        if (data !== null) dataLines.push(data)
        // Comment lines (":...") and any other field are ignored for this dialect.
      }
      if (dataLines.length === 0) continue
      const payload = dataLines.join('\n')
      if (payload.trim() === '[DONE]') continue // defensive: some callers' servers emit a sentinel; this API does not, but ignoring it is harmless.
      try {
        const parsed = JSON.parse(payload) as TEvent
        if (typeof parsed?.type === 'string') events.push(parsed)
        else this.onParseError?.(frame, new Error('event JSON has no string "type" field'))
      } catch (error) {
        this.onParseError?.(frame, error)
      }
    }
    return events
  }
}

/**
 * Convenience driver: consumes an async iterable of text chunks (e.g. a
 * decoded fetch body reader) and yields parsed events in order. Transport-
 * agnostic — callers decode bytes to text themselves (platforms differ in
 * how they expose streaming bodies), keeping this package free of any
 * platform-specific streaming API assumption.
 */
export async function* iterateUnnamedSse<TEvent extends { type: string }>(
  textChunks: AsyncIterable<string>,
  options: UnnamedSseParseOptions = {},
): AsyncGenerator<TEvent> {
  const parser = new UnnamedSseParser<TEvent>(options)
  for await (const chunk of textChunks) {
    for (const event of parser.feed(chunk)) yield event
  }
}
