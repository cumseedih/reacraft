import { describe, it, expect } from 'vitest'
import { MOBILE_MODELS, DEFAULT_MODEL_ID, modelLabel } from '../lib/models'
import { KROEX_MODEL_IDS, isKroexModelId } from '@kroex/api'

describe('mobile model catalog', () => {
  it('exposes exactly the supported model IDs (no legacy/unsupported ids)', () => {
    const ids = MOBILE_MODELS.map((m) => m.id)
    expect(ids).toEqual([...KROEX_MODEL_IDS])
    for (const id of ids) expect(isKroexModelId(id)).toBe(true)
  })
  it('has a non-empty name and description for every model', () => {
    for (const m of MOBILE_MODELS) {
      expect(m.name.length).toBeGreaterThan(0)
      expect(m.description.length).toBeGreaterThan(0)
    }
  })
  it('default model is a supported id', () => {
    expect(isKroexModelId(DEFAULT_MODEL_ID)).toBe(true)
  })
  it('modelLabel returns the friendly name for a known id and echoes unknown ids', () => {
    expect(modelLabel('kroex-pro')).toBe('KROEX Pro')
    expect(modelLabel('legacy-xyz')).toBe('legacy-xyz')
  })
})
