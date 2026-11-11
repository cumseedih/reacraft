import { describe, expect, it } from 'vitest'
import { describeRetrievalMethod } from './memory-method'

describe('describeRetrievalMethod — honest retrieval labelling (deferred-RAG constraint)', () => {
  it('labels recency as recency (the fallback), never as semantic', () => {
    const m = describeRetrievalMethod('recency')
    expect(m.label).toBe('Recency')
    expect(m.isFallback).toBe(true)
    expect(m.variant).toBe('warning')
    // Must not claim semantic/RAG capability.
    expect(m.label.toLowerCase()).not.toContain('semantic')
    expect(m.description.toLowerCase()).toContain('unavailable')
  })

  it('labels semantic as semantic only when the backend actually reports it', () => {
    const m = describeRetrievalMethod('semantic')
    expect(m.label).toBe('Semantic')
    expect(m.isFallback).toBe(false)
    expect(m.variant).toBe('default')
  })

  it('recency and semantic presentations are distinct', () => {
    expect(describeRetrievalMethod('recency').label).not.toBe(describeRetrievalMethod('semantic').label)
  })
})
