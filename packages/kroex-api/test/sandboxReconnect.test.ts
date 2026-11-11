import { describe, expect, it } from 'vitest'
import { streamSandboxCommandEvents, type SandboxEventsTransport } from '../src/sse/sandboxReconnect.js'
import type { SandboxCommandEvent } from '../src/sse/named.js'

/**
 * Simulates the server closing the connection after its ~240-poll heartbeat
 * window WITHOUT a terminal exit — the documented case the driver must
 * reconnect from (spec §2.4). First connection yields seq 1-2 then ends
 * (heartbeat-close simulation); the driver must reconnect with
 * after_seq=2, and the second connection yields seq 3 + the exit event.
 */
function makeTwoLegTransport(): { transport: SandboxEventsTransport; openedWith: string[] } {
  const openedWith: string[] = []
  let call = 0
  const transport: SandboxEventsTransport = {
    async *openStream(params) {
      openedWith.push(params.query)
      call += 1
      if (call === 1) {
        yield 'id: 1\nevent: output\ndata: {"seq": 1, "stream": "stdout", "data": "a"}\n\n'
        yield 'id: 2\nevent: output\ndata: {"seq": 2, "stream": "stdout", "data": "b"}\n\n'
        // Connection ends here with no exit frame — simulates the heartbeat timeout close.
        return
      }
      yield 'id: 3\nevent: output\ndata: {"seq": 3, "stream": "stdout", "data": "c"}\n\n'
      yield 'event: exit\ndata: {"status": "succeeded", "exit_code": 0, "duration_ms": 5, "bytes_out": 3, "output_truncated": false}\n\n'
    },
  }
  return { transport, openedWith }
}

describe('streamSandboxCommandEvents — sequence-based reconnection', () => {
  it('reconnects with the correct after_seq once the first connection ends without an exit event', async () => {
    const { transport, openedWith } = makeTwoLegTransport()
    const events: SandboxCommandEvent[] = []
    for await (const event of streamSandboxCommandEvents(transport)) {
      events.push(event)
    }

    expect(openedWith).toEqual(['after_seq=0', 'after_seq=2'])
    expect(events.map((e) => ('seq' in e ? e.seq : e.event))).toEqual([1, 2, 3, 'exit'])
  })

  it('stops yielding immediately once a real exit event is observed (no further reconnects)', async () => {
    const transport: SandboxEventsTransport = {
      async *openStream() {
        yield 'event: exit\ndata: {"status": "failed", "exit_code": 1, "duration_ms": 1, "bytes_out": 0, "output_truncated": false}\n\n'
      },
    }
    const events: SandboxCommandEvent[] = []
    for await (const event of streamSandboxCommandEvents(transport)) events.push(event)
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({ event: 'exit', status: 'failed' })
  })

  it('stops after maxReconnects is exceeded even without a terminal exit', async () => {
    let calls = 0
    const transport: SandboxEventsTransport = {
      async *openStream() {
        calls += 1
        yield 'event: heartbeat\ndata: {"seq": 0}\n\n'
      },
    }
    const events: SandboxCommandEvent[] = []
    for await (const event of streamSandboxCommandEvents(transport, { maxReconnects: 2 })) events.push(event)
    expect(calls).toBe(3) // initial attempt + 2 reconnects
    expect(events.every((e) => e.event === 'heartbeat')).toBe(true)
  })

  it('stops immediately if the signal is already aborted', async () => {
    const controller = new AbortController()
    controller.abort()
    let opened = false
    const transport: SandboxEventsTransport = {
      // eslint-disable-next-line require-yield
      async *openStream() {
        opened = true
      },
    }
    const events: SandboxCommandEvent[] = []
    for await (const event of streamSandboxCommandEvents(transport, { signal: controller.signal })) events.push(event)
    expect(events).toEqual([])
    expect(opened).toBe(false)
  })
})
