import { describe, expect, it } from 'vitest'
import { describeSessionState, describeRestoreState } from './sandbox'

describe('describeSessionState (spec §1.9)', () => {
  it('marks provisioning/running/idle as live', () => {
    for (const s of ['provisioning', 'running', 'idle']) expect(describeSessionState(s).live).toBe(true)
  })
  it('marks stopped/failed/destroyed as not live', () => {
    for (const s of ['stopped', 'failed', 'destroyed']) expect(describeSessionState(s).live).toBe(false)
  })
})

describe('describeRestoreState (restore_state contract)', () => {
  it('queued/running are in-progress and NOT complete (resume must be blocked)', () => {
    expect(describeRestoreState('queued').inProgress).toBe(true)
    expect(describeRestoreState('running').inProgress).toBe(true)
    expect(describeRestoreState('queued').complete).toBe(false)
    expect(describeRestoreState('running').complete).toBe(false)
  })
  it('only completed is complete — never claims success before completed', () => {
    expect(describeRestoreState('completed').complete).toBe(true)
    for (const s of ['idle', 'queued', 'running', 'failed'] as const) {
      expect(describeRestoreState(s).complete).toBe(false)
    }
  })
  it('failed is not in progress and not complete', () => {
    const f = describeRestoreState('failed')
    expect(f.inProgress).toBe(false)
    expect(f.complete).toBe(false)
  })
})
