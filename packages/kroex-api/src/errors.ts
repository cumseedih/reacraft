/**
 * Standardized error handling.
 * Source: API Integration Specification §5 (Error contract).
 */

/** A single pydantic validation error object (422 shape). */
export interface ValidationErrorItem {
  loc: Array<string | number>
  msg: string
  type: string
}

/**
 * Every FastAPI error body is `{"detail": ...}`. `detail` is a plain string
 * EXCEPT for 422 responses, where it is an array of ValidationErrorItem
 * (spec §5.1). Clients must handle both shapes — never assume one.
 */
export type ErrorDetail = string | ValidationErrorItem[]

export interface RawErrorBody {
  detail?: ErrorDetail
}

/**
 * 404 is deliberately overloaded (spec §5.3): it means "not found" for a
 * missing resource, but is ALSO returned when a flag-gated surface is off,
 * and for cross-user access to someone else's resource. Clients MUST NOT
 * render a 404 as a permission error — the correct, honest treatment is
 * "this isn't available", with no inference about why.
 */
export const KROEX_404_IS_OVERLOADED_NOTE =
  '404 may mean: resource missing, flag-gated surface disabled, or cross-user access denied. Treat uniformly as "not available".'

export class KroexApiError extends Error {
  readonly status: number
  readonly detail: ErrorDetail
  /** Present only on 429s where the server sent Retry-After (spec §5.4). */
  readonly retryAfterSeconds: number | null

  constructor(status: number, detail: ErrorDetail, retryAfterSeconds: number | null = null) {
    super(typeof detail === 'string' ? detail : 'Validation failed')
    this.name = 'KroexApiError'
    this.status = status
    this.detail = detail
    this.retryAfterSeconds = retryAfterSeconds
  }

  /** True for the overloaded-404 case (§5.3) — see KROEX_404_IS_OVERLOADED_NOTE. */
  get isNotFoundOrUnavailable(): boolean {
    return this.status === 404
  }

  get isValidationError(): boolean {
    return this.status === 422 && Array.isArray(this.detail)
  }

  get isRateLimited(): boolean {
    return this.status === 429
  }

  get isAuthError(): boolean {
    return this.status === 401
  }

  /** Human-displayable text regardless of which detail shape arrived. */
  get displayMessage(): string {
    if (typeof this.detail === 'string') return this.detail
    return this.detail.map((e) => e.msg).join('; ') || 'Validation failed'
  }
}

/** Parses a Retry-After header (seconds form only — the spec never documents HTTP-date form). */
export function parseRetryAfter(headerValue: string | null): number | null {
  if (!headerValue) return null
  const seconds = Number(headerValue)
  return Number.isFinite(seconds) && seconds >= 0 ? seconds : null
}

/** Builds a KroexApiError from a parsed JSON error body + response metadata. */
export function toKroexApiError(
  status: number,
  body: RawErrorBody | undefined,
  retryAfterHeader: string | null,
): KroexApiError {
  const detail: ErrorDetail = body?.detail ?? `Request failed with status ${status}`
  return new KroexApiError(status, detail, parseRetryAfter(retryAfterHeader))
}

/**
 * A network-level failure (DNS, connection refused, offline) distinct from
 * a server-returned error — no HTTP response was ever received.
 */
export class KroexNetworkError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message)
    this.name = 'KroexNetworkError'
  }
}

/** Raised when a request/stream was cancelled via its CancellationHandle. */
export class KroexCancelledError extends Error {
  constructor() {
    super('Request was cancelled')
    this.name = 'KroexCancelledError'
  }
}
