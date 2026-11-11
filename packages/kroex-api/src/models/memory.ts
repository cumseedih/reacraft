/** Source: API Integration Specification §1.5, Compatibility Report C3. */
import type { IsoDateTime } from './common'

export interface MemoryCreate {
  content: string
  source?: string
}

export interface MemoryOut {
  id: string
  content: string
  source: string
  created_at: IsoDateTime
}

/**
 * `method` is "semantic" or "recency". IMPORTANT: embeddings are currently
 * unavailable via the OmniRoute gateway on staging (Compatibility Report C3)
 * — results are ordered by the recency fallback. Clients must render
 * whatever `method` the backend actually reports and MUST NOT hard-code or
 * imply "semantic" search quality in copy/UI regardless of this type
 * allowing both values.
 */
export interface MemorySearchResult {
  contents: string[]
  method: 'semantic' | 'recency'
}
