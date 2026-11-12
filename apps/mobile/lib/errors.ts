import { KroexApiError, KroexNetworkError, KroexCancelledError } from '@kroex/api'

/**
 * Normalizes any thrown value into a short, user-displayable message. Handles
 * the two 422 detail shapes (via KroexApiError.displayMessage), network
 * failures, and cancellations.
 */
export function getApiError(error: unknown): string {
  if (error instanceof KroexApiError) return error.displayMessage
  if (error instanceof KroexNetworkError) {
    return 'Network error — could not reach the KROEX backend. Check your connection and the configured API URL.'
  }
  if (error instanceof KroexCancelledError) return 'Request was cancelled.'
  if (error instanceof Error) return error.message
  return 'An unexpected error occurred.'
}

/**
 * True when the error is the overloaded 404 (spec §5.3): resource missing,
 * flag-gated surface disabled, or cross-user access. The honest treatment is
 * "this isn't available" with no inference about why.
 */
export function isUnavailable(error: unknown): boolean {
  return error instanceof KroexApiError && error.isNotFoundOrUnavailable
}

export function isAuthError(error: unknown): boolean {
  return error instanceof KroexApiError && error.isAuthError
}

/** Copy for a feature that returned 404 (disabled / unavailable). */
export const FEATURE_UNAVAILABLE_MESSAGE =
  "This feature isn't available on your account or backend right now."
