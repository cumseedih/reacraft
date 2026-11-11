import { describe, expect, it, vi } from 'vitest'
import { withRetryAfter429 } from '../src/client/retry.js'
import { KroexApiError } from '../src/errors.js'

describe('withRetryAfter429 (spec §5.4, §9 guidance #8)', () => {
  it('retries once after the Retry-After duration, then succeeds', async () => {
    const sleep = vi.fn(async () => {})
    let attempts = 0
    const fn = vi.fn(async () => {
      attempts += 1
      if (attempts === 1) throw new KroexApiError(429, 'Rate limit exceeded for sandbox; try again shortly.', 30)
      return 'ok'
    })

    const result = await withRetryAfter429(fn, { sleep })
    expect(result).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(2)
    expect(sleep).toHaveBeenCalledWith(30_000)
  })

  it('does not retry non-429 errors', async () => {
    const sleep = vi.fn(async () => {})
    const fn = vi.fn(async () => {
      throw new KroexApiError(404, 'Not found')
    })
    await expect(withRetryAfter429(fn, { sleep })).rejects.toMatchObject({ status: 404 })
    expect(fn).toHaveBeenCalledTimes(1)
    expect(sleep).not.toHaveBeenCalled()
  })

  it('gives up after maxRetries and rethrows the 429', async () => {
    const sleep = vi.fn(async () => {})
    const fn = vi.fn(async () => {
      throw new KroexApiError(429, 'Rate limit exceeded.', 5)
    })
    await expect(withRetryAfter429(fn, { sleep, maxRetries: 2 })).rejects.toMatchObject({ status: 429 })
    expect(fn).toHaveBeenCalledTimes(3) // initial + 2 retries
    expect(sleep).toHaveBeenCalledTimes(2)
  })

  it('falls back to fallbackDelayMs when the server sent no Retry-After', async () => {
    const sleep = vi.fn(async () => {})
    let attempts = 0
    const fn = vi.fn(async () => {
      attempts += 1
      if (attempts === 1) throw new KroexApiError(429, 'Rate limit exceeded.', null)
      return 'ok'
    })
    await withRetryAfter429(fn, { sleep, fallbackDelayMs: 5000 })
    expect(sleep).toHaveBeenCalledWith(5000)
  })
})
