import { describe, it, expect } from 'vitest'
import { KroexApiError, KroexNetworkError, KroexCancelledError } from '@kroex/api'
import { getApiError, isUnavailable, isAuthError } from '../lib/errors'

describe('getApiError', () => {
  it('uses KroexApiError.displayMessage for string detail', () => {
    expect(getApiError(new KroexApiError(400, 'Bad thing'))).toBe('Bad thing')
  })
  it('joins 422 validation detail messages', () => {
    const err = new KroexApiError(422, [
      { loc: ['body', 'email'], msg: 'invalid email', type: 'value_error' },
      { loc: ['body', 'password'], msg: 'too short', type: 'value_error' },
    ])
    expect(getApiError(err)).toContain('invalid email')
    expect(getApiError(err)).toContain('too short')
  })
  it('gives a friendly message for network errors', () => {
    expect(getApiError(new KroexNetworkError('offline')).toLowerCase()).toContain('network error')
  })
  it('handles cancellation', () => {
    expect(getApiError(new KroexCancelledError()).toLowerCase()).toContain('cancelled')
  })
  it('falls back for unknown throwables', () => {
    expect(getApiError('weird')).toBe('An unexpected error occurred.')
  })
})

describe('isUnavailable — overloaded 404', () => {
  it('is true for 404', () => {
    expect(isUnavailable(new KroexApiError(404, 'Not Found'))).toBe(true)
  })
  it('is false for other statuses and non-api errors', () => {
    expect(isUnavailable(new KroexApiError(500, 'boom'))).toBe(false)
    expect(isUnavailable(new Error('x'))).toBe(false)
  })
})

describe('isAuthError', () => {
  it('is true only for 401', () => {
    expect(isAuthError(new KroexApiError(401, 'Unauthorized'))).toBe(true)
    expect(isAuthError(new KroexApiError(403, 'Forbidden'))).toBe(false)
  })
})
