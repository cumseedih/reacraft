import { describe, it, expect } from 'vitest'
import {
  describeRetrievalMethod,
  isDestructiveAction,
  describeActionStatus,
  describeRunStatus,
  describeSessionState,
  describeRestoreState,
  describeCommandStatus,
} from '../lib/status'

describe('describeRetrievalMethod — honest recency vs semantic', () => {
  it('labels recency as a fallback and never implies semantic quality', () => {
    const r = describeRetrievalMethod('recency')
    expect(r.label).toBe('Recency')
    expect(r.isFallback).toBe(true)
    expect(r.description.toLowerCase()).toContain('semantic search is unavailable')
    expect(r.description.toLowerCase()).not.toContain('ranked by meaning')
  })
  it('labels semantic only when the backend reports semantic', () => {
    const r = describeRetrievalMethod('semantic')
    expect(r.label).toBe('Semantic')
    expect(r.isFallback).toBe(false)
  })
})

describe('isDestructiveAction — confirmation gating', () => {
  it('treats known destructive actions as requiring confirmation', () => {
    expect(isDestructiveAction('project.delete')).toBe(true)
    expect(isDestructiveAction('memory.delete')).toBe(true)
    expect(isDestructiveAction('sandbox.exec')).toBe(true)
    expect(isDestructiveAction('sandbox.stop')).toBe(true)
  })
  it('treats known read/create actions as non-destructive', () => {
    expect(isDestructiveAction('project.list')).toBe(false)
    expect(isDestructiveAction('memory.create')).toBe(false)
  })
  it('defaults UNKNOWN actions to requiring confirmation (no trusted bypass)', () => {
    expect(isDestructiveAction('something.new')).toBe(true)
    expect(isDestructiveAction('')).toBe(true)
  })
})

describe('describeActionStatus', () => {
  it('marks proposed actions as awaiting a decision', () => {
    expect(describeActionStatus('proposed').awaitingDecision).toBe(true)
  })
  it('does not mark executed/rejected as awaiting', () => {
    expect(describeActionStatus('executed').awaitingDecision).toBe(false)
    expect(describeActionStatus('rejected').awaitingDecision).toBe(false)
  })
})

describe('describeRunStatus — never succeeded before terminal', () => {
  it('keeps queued/running in-progress and not terminal', () => {
    expect(describeRunStatus('queued')).toMatchObject({ inProgress: true, isTerminal: false })
    expect(describeRunStatus('running')).toMatchObject({ inProgress: true, isTerminal: false })
  })
  it('only reports succeeded as a terminal success', () => {
    const s = describeRunStatus('succeeded')
    expect(s).toMatchObject({ isTerminal: true, inProgress: false, variant: 'success' })
  })
  it('never labels a non-succeeded status "Succeeded"', () => {
    for (const st of ['queued', 'running', 'failed', 'cancelled', 'dead']) {
      expect(describeRunStatus(st).label).not.toBe('Succeeded')
    }
  })
})

describe('describeSessionState', () => {
  it('marks running/idle/provisioning as live', () => {
    expect(describeSessionState('running').live).toBe(true)
    expect(describeSessionState('idle').live).toBe(true)
    expect(describeSessionState('provisioning').live).toBe(true)
  })
  it('marks stopped/failed/destroyed as not live', () => {
    expect(describeSessionState('stopped').live).toBe(false)
    expect(describeSessionState('failed').live).toBe(false)
    expect(describeSessionState('destroyed').live).toBe(false)
  })
})

describe('describeRestoreState — never complete before `completed`', () => {
  it('queued/running are in-progress and not complete', () => {
    expect(describeRestoreState('queued')).toMatchObject({ inProgress: true, complete: false })
    expect(describeRestoreState('running')).toMatchObject({ inProgress: true, complete: false })
  })
  it('only completed is complete', () => {
    expect(describeRestoreState('completed')).toMatchObject({ complete: true, inProgress: false })
  })
  it('failed is neither in-progress nor complete', () => {
    expect(describeRestoreState('failed')).toMatchObject({ complete: false, inProgress: false })
  })
  it('idle/undefined are neither', () => {
    expect(describeRestoreState('idle')).toMatchObject({ complete: false, inProgress: false })
    expect(describeRestoreState(undefined)).toMatchObject({ complete: false, inProgress: false })
    expect(describeRestoreState(null)).toMatchObject({ complete: false, inProgress: false })
  })
})

describe('describeCommandStatus', () => {
  it('keeps queued/running in-progress', () => {
    expect(describeCommandStatus('running').inProgress).toBe(true)
    expect(describeCommandStatus('queued').inProgress).toBe(true)
  })
  it('marks terminal statuses not in-progress', () => {
    for (const st of ['succeeded', 'failed', 'killed', 'timeout', 'cancelled']) {
      expect(describeCommandStatus(st).inProgress).toBe(false)
    }
  })
})
