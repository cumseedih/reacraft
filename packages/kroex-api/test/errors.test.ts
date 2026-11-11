import { describe, expect, it } from 'vitest'
import { KroexApiError, parseRetryAfter, toKroexApiError } from '../src/errors.js'

describe('error contract (spec §5)', () => {
  it('handles the plain-string detail shape (§5.1, the common case)', () => {
    const error = toKroexApiError(404, { detail: 'Conversation not found' }, null)
    expect(error.status).toBe(404)
    expect(error.detail).toBe('Conversation not found')
    expect(error.displayMessage).toBe('Conversation not found')
    expect(error.isNotFoundOrUnavailable).toBe(true)
    expect(error.isValidationError).toBe(false)
  })

  it('handles the 422 validation-array detail shape (§5.1, the exception)', () => {
    const error = toKroexApiError(
      422,
      { detail: [{ loc: ['body', 'password'], msg: 'String should have at least 8 characters', type: 'string_too_short' }] },
      null,
    )
    expect(error.isValidationError).toBe(true)
    expect(error.displayMessage).toBe('String should have at least 8 characters')
  })

  it('parses Retry-After into retryAfterSeconds on 429 (§5.4)', () => {
    const error = toKroexApiError(429, { detail: 'Rate limit exceeded for sandbox; try again shortly.' }, '30')
    expect(error.isRateLimited).toBe(true)
    expect(error.retryAfterSeconds).toBe(30)
  })

  it('parseRetryAfter rejects non-numeric / negative values', () => {
    expect(parseRetryAfter(null)).toBeNull()
    expect(parseRetryAfter('not-a-number')).toBeNull()
    expect(parseRetryAfter('-5')).toBeNull()
    expect(parseRetryAfter('60')).toBe(60)
  })

  it('isAuthError is true only for 401', () => {
    expect(new KroexApiError(401, 'Not authenticated').isAuthError).toBe(true)
    expect(new KroexApiError(404, 'x').isAuthError).toBe(false)
  })

  it('404 is treated uniformly regardless of WHY it was returned (§5.3 — flag-off, cross-user, and truly-missing are indistinguishable by design)', () => {
    const flagOff = toKroexApiError(404, { detail: 'Not found' }, null)
    const crossUser = toKroexApiError(404, { detail: 'Agent not found' }, null)
    expect(flagOff.isNotFoundOrUnavailable).toBe(true)
    expect(crossUser.isNotFoundOrUnavailable).toBe(true)
  })
})
