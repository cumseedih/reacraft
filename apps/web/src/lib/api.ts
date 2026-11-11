import axios, { AxiosError, type AxiosRequestConfig } from 'axios'
import { UnnamedSseParser, type ChatStreamEvent } from '@kroex/api'
import type { ApiError } from '@/types'

/**
 * Base URL resolution.
 *
 * Default (unset NEXT_PUBLIC_API_URL): '' — same-origin, so browser calls
 * hit this app's own /api/* route handlers, which proxy server-side to
 * BACKEND_URL. This is the path STAGING_CONFIG.md prescribes, because the
 * staging API is loopback-only and unreachable from a browser; it also
 * removes any CORS dependency. Works identically against a local backend.
 *
 * Set NEXT_PUBLIC_API_URL to call an API origin directly from the browser
 * instead (local-dev escape hatch; requires that origin to allow CORS).
 */
const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? ''

export const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
})

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('kroex_token')
    if (token) config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError<ApiError>) => {
    if (error.response?.status === 401) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('kroex_token')
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

export async function get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
  const res = await api.get<T>(url, config)
  return res.data
}

export async function post<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
  const res = await api.post<T>(url, data, config)
  return res.data
}

export async function put<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
  const res = await api.put<T>(url, data, config)
  return res.data
}

export async function patch<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
  const res = await api.patch<T>(url, data, config)
  return res.data
}

export async function del<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
  const res = await api.delete<T>(url, config)
  return res.data
}

/**
 * chatStream sends a streaming chat request and returns both the
 * conversation ID (from the X-Conversation-Id response header) and an
 * async generator that yields raw SSE data payloads.
 *
 * Capturing the header before reading the body is the reason this exists
 * separately from streamSSE.
 */
export async function chatStream(
  payload: {
    message: string
    messages: Array<{ role: string; content: string }>
    model: string
    conversation_id?: string
  },
  signal?: AbortSignal,
): Promise<{ conversationId: string | null; generator: AsyncGenerator<string> }> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('kroex_token') : null
  const res = await fetch(`${BASE_URL}/api/chat/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
    signal,
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail ?? err.message ?? 'Stream failed')
  }

  const conversationId = res.headers.get('x-conversation-id')

  async function* gen(): AsyncGenerator<string> {
    if (!res.body) return
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6).trim()
          if (data === '[DONE]') return
          yield data
        }
      }
    }
  }

  return { conversationId, generator: gen() }
}

/**
 * Typed chat streaming built on the shared @kroex/api SSE parser.
 *
 * Preferred over chatStream(): it yields parsed, discriminated
 * ChatStreamEvent values (delta | done | error | artifact, spec §2.1)
 * instead of raw JSON strings, and it reuses the unit-tested frame buffer
 * so a frame split across network chunks can never corrupt a JSON parse
 * (spec §9 guidance #2). chatStream() is kept for backward compatibility.
 */
export async function chatStreamEvents(
  payload: {
    message: string
    messages: Array<{ role: string; content: string }>
    model: string
    conversation_id?: string
  },
  signal?: AbortSignal,
): Promise<{ conversationId: string | null; events: AsyncGenerator<ChatStreamEvent> }> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('kroex_token') : null
  const res = await fetch(`${BASE_URL}/api/chat/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
    signal,
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail ?? err.message ?? 'Stream failed')
  }

  const conversationId = res.headers.get('x-conversation-id')

  async function* events(): AsyncGenerator<ChatStreamEvent> {
    if (!res.body) return
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    const parser = new UnnamedSseParser<ChatStreamEvent>()
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      for (const event of parser.feed(decoder.decode(value, { stream: true }))) {
        yield event
      }
    }
  }

  return { conversationId, events: events() }
}

export async function* streamSSE(url: string, body: unknown): AsyncGenerator<string> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('kroex_token') : null
  const res = await fetch(`${BASE_URL}${url}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Stream failed' }))
    throw new Error(err.message ?? 'Stream request failed')
  }
  if (!res.body) throw new Error('No response body')

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6).trim()
        if (data === '[DONE]') return
        yield data
      }
    }
  }
}

export function getApiError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    return error.response?.data?.detail ?? error.response?.data?.message ?? error.message
  }
  if (error instanceof Error) return error.message
  return 'An unexpected error occurred'
}
