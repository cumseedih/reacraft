import { fetch as expoFetch } from 'expo/fetch'
import * as SecureStore from 'expo-secure-store'
import {
  UnnamedSseParser,
  streamSandboxCommandEvents,
  type ChatStreamEvent,
  type BotStreamEvent,
  type AgentRunStreamEvent,
  type SandboxCommandEvent,
  type SandboxEventsTransport,
} from '@kroex/api'
import { requireApiBaseUrl } from './config'

/**
 * Streaming layer for the mobile app.
 *
 * React Native's built-in fetch returns a null response body, so it cannot
 * stream. `expo/fetch` is a spec-compliant fetch with a real ReadableStream
 * body on native — it is the only correct primitive for SSE on Android/iOS.
 * All four streaming endpoints (spec §2.1–§2.4) go through it here, reusing
 * the unit-tested @kroex/api parsers so a frame split across network chunks
 * can never corrupt a JSON parse.
 */

async function authHeaders(extra?: Record<string, string>): Promise<Record<string, string>> {
  const token = await SecureStore.getItemAsync('kroex_token')
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  }
}

async function errorText(res: { json: () => Promise<unknown>; statusText?: string; status: number }): Promise<string> {
  const body = (await res.json().catch(() => undefined)) as { detail?: unknown } | undefined
  const detail = body?.detail
  if (typeof detail === 'string') return detail
  return `Request failed (${res.status})`
}

// ---------------------------------------------------------------------------
// Chat stream (§2.1)
// ---------------------------------------------------------------------------
export async function chatStreamEvents(
  payload: {
    message: string
    messages: Array<{ role: string; content: string }>
    model: string
    conversation_id?: string
  },
  signal?: AbortSignal,
): Promise<{ conversationId: string | null; events: AsyncGenerator<ChatStreamEvent> }> {
  const base = requireApiBaseUrl()
  const res = await expoFetch(`${base}/api/chat/stream`, {
    method: 'POST',
    headers: await authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
    signal,
  })
  if (!res.ok) throw new Error(await errorText(res))
  const conversationId = res.headers.get('x-conversation-id')

  async function* events(): AsyncGenerator<ChatStreamEvent> {
    if (!res.body) return
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    const parser = new UnnamedSseParser<ChatStreamEvent>()
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      for (const event of parser.feed(decoder.decode(value, { stream: true }))) yield event
    }
  }
  return { conversationId, events: events() }
}

// ---------------------------------------------------------------------------
// BOT chat stream (§2.2)
// ---------------------------------------------------------------------------
export async function botStreamEvents(
  payload: { message: string; model?: string },
  signal?: AbortSignal,
): Promise<{ conversationId: string | null; events: AsyncGenerator<BotStreamEvent> }> {
  const base = requireApiBaseUrl()
  const res = await expoFetch(`${base}/api/bot/chat/stream`, {
    method: 'POST',
    headers: await authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
    signal,
  })
  if (!res.ok) throw new Error(await errorText(res))
  const conversationId = res.headers.get('x-conversation-id')

  async function* events(): AsyncGenerator<BotStreamEvent> {
    if (!res.body) return
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    const parser = new UnnamedSseParser<BotStreamEvent>()
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      for (const event of parser.feed(decoder.decode(value, { stream: true }))) yield event
    }
  }
  return { conversationId, events: events() }
}

// ---------------------------------------------------------------------------
// Agent-run event stream (§2.3) — GET, poll-based, reconnect after ~2 min
// ---------------------------------------------------------------------------
export async function agentRunEvents(
  runId: string,
  signal?: AbortSignal,
): Promise<AsyncGenerator<AgentRunStreamEvent>> {
  const base = requireApiBaseUrl()
  const res = await expoFetch(`${base}/api/agent-runs/${runId}/events`, {
    method: 'GET',
    headers: await authHeaders(),
    signal,
  })
  if (!res.ok) throw new Error(await errorText(res))

  async function* events(): AsyncGenerator<AgentRunStreamEvent> {
    if (!res.body) return
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    const parser = new UnnamedSseParser<AgentRunStreamEvent>()
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      for (const event of parser.feed(decoder.decode(value, { stream: true }))) yield event
    }
  }
  return events()
}

// ---------------------------------------------------------------------------
// Sandbox command events (§2.4) — named SSE with seq-based reconnection
// ---------------------------------------------------------------------------
function commandEventsTransport(commandId: string): SandboxEventsTransport {
  const base = requireApiBaseUrl()
  return {
    async *openStream(params, signal) {
      const res = await expoFetch(`${base}/api/sandbox/commands/${commandId}/events?${params.query}`, {
        method: 'GET',
        headers: await authHeaders(params.headers),
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
