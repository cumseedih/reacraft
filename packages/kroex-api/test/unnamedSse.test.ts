import { describe, expect, it } from 'vitest'
import { UnnamedSseParser, iterateUnnamedSse } from '../src/sse/unnamed.js'
import type { ChatStreamEvent, BotStreamEvent, AgentRunStreamEvent } from '../src/sse/events.js'

// Frame text below is built from the EXACT JSON shapes documented in the
// API Integration Specification §2.1-§2.3.

describe('UnnamedSseParser — chat stream (spec §2.1)', () => {
  it('parses delta, done, and artifact frames fed as one chunk', () => {
    const frame =
      'data: {"type": "delta", "text": "Hello"}\n\n' +
      'data: {"type": "done", "model": "claude-sonnet-4-6", "usage": {"input": 12, "output": 3}}\n\n' +
      'data: {"type": "artifact", "artifact": {"id": "11111111-1111-1111-1111-111111111111", "title": "Python snippet", "type": "code", "language": "python", "content": "print(1)"}}\n\n'

    const parser = new UnnamedSseParser<ChatStreamEvent>()
    const events = parser.feed(frame)

    expect(events).toHaveLength(3)
    expect(events[0]).toEqual({ type: 'delta', text: 'Hello' })
    expect(events[1]).toEqual({
      type: 'done',
      model: 'claude-sonnet-4-6',
      usage: { input: 12, output: 3 },
    })
    expect(events[2]).toMatchObject({ type: 'artifact', artifact: { language: 'python' } })
  })

  it('parses an error frame', () => {
    const parser = new UnnamedSseParser<ChatStreamEvent>()
    const events = parser.feed('data: {"type": "error", "message": "boom"}\n\n')
    expect(events).toEqual([{ type: 'error', message: 'boom' }])
  })

  it('buffers a frame split across multiple network chunks (spec §9 guidance #2: reassemble before interpreting)', () => {
    const parser = new UnnamedSseParser<ChatStreamEvent>()
    // Split mid-JSON, mid-field-name, and mid-frame-terminator to stress the buffer.
    const whole = 'data: {"type": "delta", "text": "straddled chunk"}\n\n'
    const splitPoints = [10, 25, whole.length - 1]
    let events: ChatStreamEvent[] = []
    let prev = 0
    for (const point of splitPoints) {
      events = events.concat(parser.feed(whole.slice(prev, point)))
      prev = point
    }
    events = events.concat(parser.feed(whole.slice(prev)))
    expect(events).toEqual([{ type: 'delta', text: 'straddled chunk' }])
  })

  it('iterateUnnamedSse drives an async iterable of chunks end to end', async () => {
    async function* chunks() {
      yield 'data: {"type": "delta", "te'
      yield 'xt": "ab"}\n\ndata: {"type": "done", "model": "m", "usage": {"input": 1, "output": 1}}\n\n'
    }
    const collected: ChatStreamEvent[] = []
    for await (const event of iterateUnnamedSse<ChatStreamEvent>(chunks())) collected.push(event)
    expect(collected).toEqual([
      { type: 'delta', text: 'ab' },
      { type: 'done', model: 'm', usage: { input: 1, output: 1 } },
    ])
  })
})

describe('UnnamedSseParser — bot stream (spec §2.2)', () => {
  it('parses action and action_result frames, plus the shared delta/done shapes', () => {
    const frame =
      'data: {"type": "action", "action": {"id": "a1", "action": "memory.create", "status": "executed", "result": {"id": "m1"}, "error": null}}\n\n' +
      'data: {"type": "action_result", "action_id": "a1", "result": {"id": "m1"}}\n\n' +
      'data: {"type": "delta", "text": "Done — I saved that to memory."}\n\n' +
      'data: {"type": "done", "model": "claude-sonnet-4-6", "usage": {"input": 5, "output": 2}}\n\n'

    const events = new UnnamedSseParser<BotStreamEvent>().feed(frame)
    expect(events).toHaveLength(4)
    expect(events[0]).toMatchObject({ type: 'action', action: { action: 'memory.create', status: 'executed' } })
    expect(events[1]).toEqual({ type: 'action_result', action_id: 'a1', result: { id: 'm1' } })
  })
})

describe('UnnamedSseParser — agent run events (spec §2.3)', () => {
  it('parses run_status, sandbox_step, whole-message delta, and done', () => {
    const frame =
      'data: {"type": "run_status", "status": "running"}\n\n' +
      'data: {"type": "sandbox_step", "command_id": "c1", "command": "pip install requests", "status": "succeeded", "exit_code": 0}\n\n' +
      'data: {"type": "delta", "text": "I installed requests and ran the script."}\n\n' +
      'data: {"type": "done", "status": "succeeded"}\n\n'

    const events = new UnnamedSseParser<AgentRunStreamEvent>().feed(frame)
    expect(events).toEqual([
      { type: 'run_status', status: 'running' },
      { type: 'sandbox_step', command_id: 'c1', command: 'pip install requests', status: 'succeeded', exit_code: 0 },
      { type: 'delta', text: 'I installed requests and ran the script.' },
      { type: 'done', status: 'succeeded' },
    ])
  })

  it('parses both documented error messages verbatim', () => {
    const notFound = new UnnamedSseParser<AgentRunStreamEvent>().feed(
      'data: {"type": "error", "message": "Run not found"}\n\n',
    )
    const timeout = new UnnamedSseParser<AgentRunStreamEvent>().feed(
      'data: {"type": "error", "message": "Events timeout; reconnect to resume"}\n\n',
    )
    expect(notFound[0]).toEqual({ type: 'error', message: 'Run not found' })
    expect(timeout[0]).toEqual({ type: 'error', message: 'Events timeout; reconnect to resume' })
  })
})

describe('UnnamedSseParser — defensive behaviour', () => {
  it('silently ignores a comment-only frame (SSE comments are valid keep-alives, not errors)', () => {
    const errors: unknown[] = []
    const parser = new UnnamedSseParser<ChatStreamEvent>({ onParseError: (_frame, err) => errors.push(err) })
    const events = parser.feed(': this is a comment, not data\n\n')
    expect(events).toEqual([])
    expect(errors).toHaveLength(0)
  })

  it('skips malformed JSON and reports it', () => {
    const errors: unknown[] = []
    const parser = new UnnamedSseParser<ChatStreamEvent>({ onParseError: (_frame, err) => errors.push(err) })
    const events = parser.feed('data: {not valid json}\n\n')
    expect(events).toEqual([])
    expect(errors).toHaveLength(1)
  })
})
