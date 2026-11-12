import {
  streamSandboxCommandEvents, type SandboxCommandEvent, type SandboxEventsTransport,
} from '@kroex/api'

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? ''

/**
 * Web transport for the named sandbox command-events SSE stream (spec §2.4).
 * Opens a single GET connection with the resume params and yields decoded
 * text chunks; the shared streamSandboxCommandEvents() driver handles frame
 * parsing, the seq cursor, and sequence-based reconnection on heartbeat
 * timeout. Same-origin by default (hits the Next proxy route).
 */
function commandEventsTransport(commandId: string): SandboxEventsTransport {
  return {
    async *openStream(params, signal) {
      const token = typeof window !== 'undefined' ? localStorage.getItem('kroex_token') : null
      const res = await fetch(`${BASE_URL}/api/sandbox/commands/${commandId}/events?${params.query}`, {
        method: 'GET',
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...params.headers },
        signal,
      })
      if (!res.ok || !res.body) throw new Error(`Command events stream failed (${res.status})`)
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        yield decoder.decode(value, { stream: true })
      }
    },
  }
}

/** Drives a command's event stream to an onEvent callback until exit/abort. */
export async function streamCommandEvents(
  commandId: string,
  onEvent: (event: SandboxCommandEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  for await (const event of streamSandboxCommandEvents(commandEventsTransport(commandId), { signal })) {
    onEvent(event)
  }
}
