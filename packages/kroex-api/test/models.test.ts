import { describe, expect, it } from 'vitest'
import { DEFAULT_KROEX_MODEL_ID, KROEX_MODEL_IDS, isKroexModelId } from '../src/models'
import { BOT_ACTION_REGISTRY } from '../src/models/bot'
import { isTerminalRunStatus } from '../src/models/agents'
import {
  SANDBOX_LOGICAL_IMAGES,
  SANDBOX_UNBUILT_IMAGE,
  filterBuiltSandboxImages,
  isSandboxSessionLive,
  isTerminalCommandStatus,
} from '../src/models/sandbox'

describe('model catalog (spec §8 + Phase-4 directive: no legacy ids exposed)', () => {
  it('exposes exactly the four supported tiers', () => {
    expect(KROEX_MODEL_IDS).toEqual(['kroex-ultra', 'kroex-pro', 'kroex-fast', 'kroex-auto'])
  })

  it('does not expose any legacy provider id', () => {
    const legacy = ['gpt-4o', 'gpt-4o-mini', 'gemini-flash', 'gemini-pro']
    for (const id of legacy) expect(isKroexModelId(id)).toBe(false)
  })

  it('isKroexModelId / default match the spec', () => {
    expect(isKroexModelId('kroex-auto')).toBe(true)
    expect(isKroexModelId('kroex-ultra')).toBe(true)
    expect(isKroexModelId('nonsense')).toBe(false)
    expect(DEFAULT_KROEX_MODEL_ID).toBe('kroex-pro')
  })
})

describe('BOT action registry (spec §1.7)', () => {
  it('has exactly the 11 documented actions', () => {
    expect(Object.keys(BOT_ACTION_REGISTRY)).toHaveLength(11)
  })

  it('flags confirmation-required actions correctly', () => {
    const requiresConfirmation = ['project.delete', 'memory.delete', 'sandbox.create', 'sandbox.exec', 'sandbox.stop']
    const noConfirmation = [
      'project.list', 'project.create', 'memory.list', 'memory.create', 'conversation.list', 'sandbox.list',
    ]
    for (const action of requiresConfirmation) {
      expect(BOT_ACTION_REGISTRY[action as keyof typeof BOT_ACTION_REGISTRY].requiresConfirmation).toBe(true)
    }
    for (const action of noConfirmation) {
      expect(BOT_ACTION_REGISTRY[action as keyof typeof BOT_ACTION_REGISTRY].requiresConfirmation).toBe(false)
    }
  })
})

describe('agent run statuses (spec §1.8)', () => {
  it('terminal statuses match TERMINAL_RUN_STATUSES exactly', () => {
    expect(isTerminalRunStatus('succeeded')).toBe(true)
    expect(isTerminalRunStatus('failed')).toBe(true)
    expect(isTerminalRunStatus('cancelled')).toBe(true)
    expect(isTerminalRunStatus('dead')).toBe(true)
    expect(isTerminalRunStatus('queued')).toBe(false)
    expect(isTerminalRunStatus('running')).toBe(false)
  })
})

describe('sandbox images (spec §6, Outstanding-Issues Report: "full" not built)', () => {
  it('lists all three logical images but filters the unbuilt one out for UI consumption', () => {
    expect(SANDBOX_LOGICAL_IMAGES).toEqual(['python', 'node', 'full'])
    expect(SANDBOX_UNBUILT_IMAGE).toBe('full')
    expect(filterBuiltSandboxImages(['python', 'node', 'full'])).toEqual(['python', 'node'])
  })

  it('does not drop unrelated images (defensive — only filters the exact unbuilt name)', () => {
    expect(filterBuiltSandboxImages(['python', 'node'])).toEqual(['python', 'node'])
  })
})

describe('sandbox session/command states (spec §1.9)', () => {
  it('identifies live session states', () => {
    expect(isSandboxSessionLive('running')).toBe(true)
    expect(isSandboxSessionLive('idle')).toBe(true)
    expect(isSandboxSessionLive('provisioning')).toBe(true)
    expect(isSandboxSessionLive('stopped')).toBe(false)
    expect(isSandboxSessionLive('destroyed')).toBe(false)
  })

  it('identifies terminal command statuses', () => {
    expect(isTerminalCommandStatus('succeeded')).toBe(true)
    expect(isTerminalCommandStatus('killed')).toBe(true)
    expect(isTerminalCommandStatus('timeout')).toBe(true)
    expect(isTerminalCommandStatus('running')).toBe(false)
    expect(isTerminalCommandStatus('queued')).toBe(false)
  })
})
