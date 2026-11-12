import { describe, expect, it } from 'vitest'
import {
  PTY_CLOSE_CODES,
  buildPtyConnectionQuery,
  describePtyCloseCode,
  encodePingFrame,
  encodeResizeFrame,
  parsePtyServerControlFrame,
} from '../src/ws/pty'

describe('PTY protocol — frames (spec §3.3)', () => {
  it('parses the hello frame exactly as documented', () => {
    const text = '{"type": "session", "handle": "h-123", "session_id": "s-456"}'
    expect(parsePtyServerControlFrame(text)).toEqual({ type: 'session', handle: 'h-123', session_id: 's-456' })
  })

  it('parses pong, closed, and notice frames', () => {
    expect(parsePtyServerControlFrame('{"type": "pong"}')).toEqual({ type: 'pong' })
    expect(parsePtyServerControlFrame('{"type": "closed"}')).toEqual({ type: 'closed' })
    expect(parsePtyServerControlFrame('{"type": "notice", "message": "output dropped: client too slow"}')).toEqual({
      type: 'notice',
      message: 'output dropped: client too slow',
    })
  })

  it('returns null for unparseable or unrecognized text frames (ignored, per spec)', () => {
    expect(parsePtyServerControlFrame('not json at all')).toBeNull()
    expect(parsePtyServerControlFrame('{"type": "something_unknown"}')).toBeNull()
  })

  it('encodes client resize and ping frames', () => {
    expect(encodeResizeFrame(100, 30)).toBe('{"type":"resize","cols":100,"rows":30}')
    expect(encodePingFrame()).toBe('{"type":"ping"}')
  })
})

describe('PTY protocol — connection query + close codes (spec §3.1-§3.2)', () => {
  it('builds the connection query with token and attach', () => {
    expect(buildPtyConnectionQuery({ token: 't1', attach: 'h-123' })).toBe('?token=t1&attach=h-123')
    expect(buildPtyConnectionQuery({})).toBe('')
  })

  it('exposes all four documented close codes with distinct meanings', () => {
    expect(PTY_CLOSE_CODES).toEqual({
      UNAUTHENTICATED: 4401,
      UNKNOWN_NOT_OWNED_OR_DISABLED: 4404,
      IDLE_TIMEOUT: 4408,
      SESSION_NOT_LIVE: 4409,
    })
    const meanings = new Set(Object.values(PTY_CLOSE_CODES).map(describePtyCloseCode))
    expect(meanings.size).toBe(4) // all four descriptions are distinct
  })

  it('falls back to a generic description for an unrecognized code', () => {
    expect(describePtyCloseCode(1006)).toMatch(/unrecognized/i)
  })
})
