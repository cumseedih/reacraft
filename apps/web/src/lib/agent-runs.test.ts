import { describe, expect, it } from 'vitest'
import { describeRunStatus } from './agent-runs'

describe('describeRunStatus (spec §1.8)', () => {
  it('treats queued/running as in-progress, not terminal', () => {
    expect(describeRunStatus('queued').inProgress).toBe(true)
    expect(describeRunStatus('running').inProgress).toBe(true)
    expect(describeRunStatus('queued').isTerminal).toBe(false)
  })
  it('treats succeeded/failed/cancelled/dead as terminal', () => {
    for (const s of ['succeeded', 'failed', 'cancelled', 'dead']) {
      expect(describeRunStatus(s).isTerminal).toBe(true)
      expect(describeRunStatus(s).inProgress).toBe(false)
    }
  })
  it('does not label an in-progress run as succeeded', () => {
    expect(describeRunStatus('running').label).not.toBe('Succeeded')
    expect(describeRunStatus('queued').label).not.toBe('Succeeded')
  })
})
