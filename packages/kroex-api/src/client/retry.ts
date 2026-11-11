import { KroexApiError } from '../errors'

export interface RetryOn429Options {
  /** Max additional attempts after the first (default 1 — one retry total, matching "batch and debounce, honour Retry-After" guidance in Compatibility Report C8/spec §9.8 rather than aggressive auto-retry loops). */
  maxRetries?: number
  /** Fallback wait when the server didn't send Retry-After (shouldn't happen per spec §5.4, but defensive). */
  fallbackDelayMs?: number
  /** Injectable for tests; defaults to a real timer. */
  sleep?: (ms: number) => Promise<void>
  /** Called before each retry wait, e.g. for UI feedback ("rate limited, retrying in 30s"). */
  onRetry?: (attempt: number, delayMs: number, error: KroexApiError) => void
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/**
 * Wraps a request function with Retry-After-aware 429 handling (spec §5.4,
 * §9.8). Both rate-limit layers (per-IP middleware and per-user surface
 * buckets) send a Retry-After header in seconds — this honours it exactly
 * rather than guessing a backoff curve. Non-429 errors propagate immediately.
 */
export async function withRetryAfter429<T>(
  fn: () => Promise<T>,
  options: RetryOn429Options = {},
): Promise<T> {
  const maxRetries = options.maxRetries ?? 1
  const fallbackDelayMs = options.fallbackDelayMs ?? 30_000
  const sleep = options.sleep ?? defaultSleep

  let attempt = 0
  while (true) {
    try {
      return await fn()
    } catch (error) {
      if (!(error instanceof KroexApiError) || !error.isRateLimited || attempt >= maxRetries) {
        throw error
      }
      attempt += 1
      const delayMs = (error.retryAfterSeconds ?? fallbackDelayMs / 1000) * 1000
      options.onRetry?.(attempt, delayMs, error)
      await sleep(delayMs)
    }
  }
}
