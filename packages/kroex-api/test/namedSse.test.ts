import { describe, expect, it } from 'vitest'
import { NamedSseParser, SandboxEventCursor, isSandboxExitEvent, isSandboxHeartbeatEvent } from '../src/sse/named'

// Frame format from spec §2.4:
//   id: <seq>            (only on output events)
//   event: <name>
//   data: {json}
//
// (blank line terminates the frame)

describe('NamedSseParser — sandbox command events (spec §2.4)', () => {
  it('parses an output frame including its id: line', () => {
    const frame = 'id: 1\nevent: output\ndata: {"seq": 1, "stream": "stdout", "data": "hello\\n"}\n\n'
    const events = new NamedSseParser().feed(frame)
    expect(events).toEqual([{ event: 'output', seq: 1, stream: 'stdout', data: 'hello\n' }])
  })

  it('parses an exit frame (no id: line, per spec)', () => {
    const frame =
      'event: exit\ndata: {"status": "succeeded", "exit_code": 0, "duration_ms": 142, "bytes_out": 6, "output_truncated": false}\n\n'
    const events = new NamedSseParser().feed(frame)
    expect(events).toEqual([
      { event: 'exit', status: 'succeeded', exit_code: 0, duration_ms: 142, bytes_out: 6, output_truncated: false },
    ])
    expect(isSandboxExitEvent(events[0]!)).toBe(true)
  })

  it('parses a heartbeat frame', () => {
    const events = new NamedSseParser().feed('event: heartbeat\ndata: {"seq": 42}\n\n')
    expect(events).toEqual([{ event: 'heartbeat', seq: 42 }])
    expect(isSandboxHeartbeatEvent(events[0]!)).toBe(true)
  })

  it('parses the documented error frame ("Command not found")', () => {
    const events = new NamedSseParser().feed('event: error\ndata: {"detail": "Command not found"}\n\n')
    expect(events).toEqual([{ event: 'error', detail: 'Command not found' }])
  })

  it('parses multiple output frames in sequence, preserving order', () => {
    const frame =
      'id: 1\nevent: output\ndata: {"seq": 1, "stream": "stdout", "data": "a"}\n\n' +
      'id: 2\nevent: output\ndata: {"seq": 2, "stream": "stderr", "data": "b"}\n\n' +
      'event: exit\ndata: {"status": "succeeded", "exit_code": 0, "duration_ms": 10, "bytes_out": 2, "output_truncated": false}\n\n'
    const events = new NamedSseParser().feed(frame)
    expect(events).toHaveLength(3)
    expect(events[0]).toMatchObject({ event: 'output', seq: 1 })
    expect(events[1]).toMatchObject({ event: 'output', seq: 2 })
    expect(events[2]).toMatchObject({ event: 'exit' })
  })

  it('buffers a frame split mid-stream across feed() calls', () => {
    const parser = new NamedSseParser()
    const whole = 'id: 5\nevent: output\ndata: {"seq": 5, "stream": "pty", "data": "straddled"}\n\n'
    const a = parser.feed(whole.slice(0, 20))
    const b = parser.feed(whole.slice(20))
    expect(a).toEqual([])
    expect(b).toEqual([{ event: 'output', seq: 5, stream: 'pty', data: 'straddled' }])
  })
})

describe('SandboxEventCursor — sequence-based resume (spec §2.4 resume contract)', () => {
  it('tracks the highest seq observed and builds matching reconnect params', () => {
    const cursor = new SandboxEventCursor()
    cursor.observe(3)
    cursor.observe(1) // out of order / duplicate — must not regress the cursor
    cursor.observe(7)
    expect(cursor.afterSeq).toBe(7)
    expect(cursor.reconnectParams()).toEqual({
      query: 'after_seq=7',
      headers: { 'Last-Event-ID': '7' },
    })
  })

  it('starts at 0 before any event is observed', () => {
    const cursor = new SandboxEventCursor()
    expect(cursor.reconnectParams()).toEqual({ query: 'after_seq=0', headers: { 'Last-Event-ID': '0' } })
  })
})
