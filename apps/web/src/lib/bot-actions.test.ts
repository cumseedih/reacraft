import { describe, expect, it } from 'vitest'
import { describeActionStatus, isDestructiveAction } from './bot-actions'

describe('isDestructiveAction (registry-driven, spec §1.7)', () => {
  it('flags the known destructive actions', () => {
    for (const a of ['project.delete', 'memory.delete', 'sandbox.create', 'sandbox.exec', 'sandbox.stop']) {
      expect(isDestructiveAction(a)).toBe(true)
    }
  })
  it('does not flag non-destructive actions', () => {
    for (const a of ['project.list', 'memory.create', 'conversation.list', 'sandbox.list']) {
      expect(isDestructiveAction(a)).toBe(false)
    }
  })
  it('defaults UNKNOWN actions to requiring confirmation (no trusted-command bypass)', () => {
    expect(isDestructiveAction('some.unknown.action')).toBe(true)
  })
})

describe('describeActionStatus — preserves proposed/confirmed/rejected/executed/failed', () => {
  it('marks only proposed as awaiting a decision', () => {
    expect(describeActionStatus('proposed').awaitingDecision).toBe(true)
    for (const s of ['confirmed', 'executed', 'failed', 'rejected']) {
      expect(describeActionStatus(s).awaitingDecision).toBe(false)
    }
  })
  it('maps statuses to distinct labels', () => {
    const labels = ['proposed', 'confirmed', 'executed', 'failed', 'rejected'].map((s) => describeActionStatus(s).label)
    expect(new Set(labels).size).toBe(5)
  })
})
