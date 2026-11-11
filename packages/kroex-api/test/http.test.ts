import { describe, expect, it, vi } from 'vitest'
import { request } from '../src/client/http.js'
import { KroexApiError, KroexCancelledError, KroexNetworkError } from '../src/errors.js'
import type { KroexClientConfig } from '../src/client/types.js'

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), { status, headers })
}

function baseConfig(overrides: Partial<KroexClientConfig> = {}): KroexClientConfig {
  return {
    baseUrl: 'https://staging.example.internal/',
    getToken: () => null,
    ...overrides,
  }
}

describe('request() — happy path', () => {
  it('attaches Authorization: Bearer <token> when a token is present', async () => {
    let capturedHeaders: Headers | undefined
    const fetchImpl = vi.fn(async (_url: string | URL, init?: RequestInit) => {
      capturedHeaders = new Headers(init?.headers)
      return jsonResponse({ ok: true })
    }) as unknown as typeof fetch

    await request(baseConfig({ fetchImpl, getToken: () => 'jwt-123' }), { method: 'GET', path: '/api/auth/me' })

    expect(capturedHeaders?.get('Authorization')).toBe('Bearer jwt-123')
  })

  it('omits Authorization when there is no token', async () => {
    let capturedHeaders: Headers | undefined
    const fetchImpl = vi.fn(async (_url: string | URL, init?: RequestInit) => {
      capturedHeaders = new Headers(init?.headers)
      return jsonResponse({ ok: true })
    }) as unknown as typeof fetch

    await request(baseConfig({ fetchImpl }), { method: 'GET', path: '/api/health' })

    expect(capturedHeaders?.has('Authorization')).toBe(false)
  })

  it('returns undefined for a 204 (spec §5.2: delete endpoints)', async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 204 })) as unknown as typeof fetch
    const result = await request(baseConfig({ fetchImpl }), { method: 'DELETE', path: '/api/projects/p1' })
    expect(result).toBeUndefined()
  })

  it('JSON-encodes the body and sets Content-Type only when a body is present', async () => {
    let capturedInit: RequestInit | undefined
    const fetchImpl = vi.fn(async (_url: string | URL, init?: RequestInit) => {
      capturedInit = init
      return jsonResponse({ id: '1' }, 201)
    }) as unknown as typeof fetch

    await request(baseConfig({ fetchImpl }), { method: 'POST', path: '/api/projects', body: { name: 'x' } })
    expect(capturedInit?.body).toBe(JSON.stringify({ name: 'x' }))
    expect(new Headers(capturedInit?.headers).get('Content-Type')).toBe('application/json')
  })
})

describe('request() — error contract (spec §5)', () => {
  it('throws KroexApiError with the plain-string detail on 404', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ detail: 'Conversation not found' }, 404)) as unknown as typeof fetch
    await expect(request(baseConfig({ fetchImpl }), { method: 'GET', path: '/x' })).rejects.toMatchObject({
      status: 404,
      detail: 'Conversation not found',
    })
  })

  it('throws KroexApiError with the array detail on 422', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ detail: [{ loc: ['body', 'email'], msg: 'bad email', type: 'value_error' }] }, 422),
    ) as unknown as typeof fetch
    const error = await request(baseConfig({ fetchImpl }), { method: 'POST', path: '/x' }).catch((e) => e)
    expect(error).toBeInstanceOf(KroexApiError)
    expect((error as KroexApiError).isValidationError).toBe(true)
  })

  it('captures Retry-After on a 429', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ detail: 'Rate limit exceeded for sandbox; try again shortly.' }, 429, { 'Retry-After': '30' }),
    ) as unknown as typeof fetch
    const error = await request(baseConfig({ fetchImpl }), { method: 'POST', path: '/x' }).catch((e) => e)
    expect((error as KroexApiError).retryAfterSeconds).toBe(30)
  })
})

describe('request() — network failure, timeout, and cancellation', () => {
  it('wraps a plain fetch rejection as KroexNetworkError', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError('Failed to fetch')
    }) as unknown as typeof fetch
    const error = await request(baseConfig({ fetchImpl }), { method: 'GET', path: '/x' }).catch((e) => e)
    expect(error).toBeInstanceOf(KroexNetworkError)
  })

  /**
   * A faithful fake fetch: real fetch implementations reject IMMEDIATELY if
   * the signal passed in is already aborted (the 'abort' event only fires on
   * the transition to aborted — it never fires retroactively), so a correct
   * fake must check `signal.aborted` synchronously up front, not rely solely
   * on the event listener.
   */
  function abortAwareHangingFetch(): typeof fetch {
    return ((_url: string | URL, init?: RequestInit) =>
      new Promise((_resolve, reject) => {
        const signal = init?.signal
        if (signal?.aborted) {
          reject(new DOMException('Aborted', 'AbortError'))
          return
        }
        signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
      })) as unknown as typeof fetch
  }

  it('times out and throws KroexNetworkError when the server never responds', async () => {
    const error = await request(
      baseConfig({ fetchImpl: abortAwareHangingFetch() }),
      { method: 'GET', path: '/x' },
      { timeoutMs: 20 },
    ).catch((e) => e)
    expect(error).toBeInstanceOf(KroexNetworkError)
    expect((error as KroexNetworkError).message).toMatch(/timed out/i)
  })

  it('throws KroexCancelledError when the caller aborts via its own signal', async () => {
    const controller = new AbortController()
    const promise = request(
      baseConfig({ fetchImpl: abortAwareHangingFetch() }),
      { method: 'GET', path: '/x' },
      { signal: controller.signal, timeoutMs: 60_000 },
    )
    controller.abort()
    await expect(promise).rejects.toBeInstanceOf(KroexCancelledError)
  })
})
