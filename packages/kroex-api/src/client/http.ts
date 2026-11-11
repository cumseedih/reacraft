import { KroexApiError, KroexCancelledError, KroexNetworkError, toKroexApiError } from '../errors'
import { DEFAULT_TIMEOUT_MS, type KroexClientConfig, type RequestOptions } from './types'

export interface JsonRequestInit {
  method: string
  path: string
  body?: unknown
  query?: Record<string, string | number | boolean | undefined>
}

function buildUrl(baseUrl: string, path: string, query?: JsonRequestInit['query']): string {
  const url = new URL(path.replace(/^\//, ''), baseUrl.endsWith('/') ? baseUrl : baseUrl + '/')
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) url.searchParams.set(key, String(value))
    }
  }
  return url.toString()
}

/** Links an internal timeout controller to an optional external signal, without requiring AbortSignal.any (kept portable across TS/lib target combinations). */
function createLinkedController(externalSignal?: AbortSignal, timeoutMs?: number | null): {
  controller: AbortController
  clear: () => void
} {
  const controller = new AbortController()
  const timers: Array<() => void> = []

  if (timeoutMs != null && timeoutMs > 0) {
    const handle = setTimeout(() => controller.abort(), timeoutMs)
    timers.push(() => clearTimeout(handle))
  }
  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort()
    } else {
      const onAbort = () => controller.abort()
      externalSignal.addEventListener('abort', onAbort)
      timers.push(() => externalSignal.removeEventListener('abort', onAbort))
    }
  }

  return { controller, clear: () => timers.forEach((fn) => fn()) }
}

/**
 * Generic authenticated JSON request. Handles: Authorization header
 * injection, timeout + cancellation (composed from config default +
 * per-call override + caller signal), standardized error parsing (§5: plain
 * string vs 422 array, Retry-After on 429), and network-vs-server error
 * distinction. Streaming bodies (SSE, PTY) do NOT go through this function —
 * see sse/* and ws/* for those, which need the raw response body/socket.
 */
export async function request<TResponse>(
  config: KroexClientConfig,
  init: JsonRequestInit,
  options: RequestOptions = {},
): Promise<TResponse> {
  const fetchImpl = config.fetchImpl ?? fetch
  const token = await config.getToken()
  const timeoutMs = options.timeoutMs !== undefined ? options.timeoutMs : config.defaultTimeoutMs ?? DEFAULT_TIMEOUT_MS
  const { controller, clear } = createLinkedController(options.signal, timeoutMs)

  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  }

  let response: Response
  try {
    response = await fetchImpl(buildUrl(config.baseUrl, init.path, init.query), {
      method: init.method,
      headers,
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      signal: controller.signal,
    })
  } catch (error) {
    if (controller.signal.aborted && options.signal?.aborted) {
      throw new KroexCancelledError()
    }
    if (controller.signal.aborted) {
      throw new KroexNetworkError(`Request timed out after ${timeoutMs}ms`, error)
    }
    throw new KroexNetworkError('Network request failed (no response received)', error)
  } finally {
    clear()
  }

  if (!response.ok) {
    const body = await response.json().catch(() => undefined)
    throw toKroexApiError(response.status, body, response.headers.get('Retry-After'))
  }

  if (response.status === 204) return undefined as TResponse
  return (await response.json()) as TResponse
}

export { KroexApiError, KroexNetworkError, KroexCancelledError }
