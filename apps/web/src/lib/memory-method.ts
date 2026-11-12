import type { MemorySearchResult } from '@kroex/api'

export type RetrievalMethod = MemorySearchResult['method']

export interface MethodPresentation {
  label: string
  description: string
  /** Badge variant from components/ui/badge. */
  variant: 'default' | 'warning'
  isFallback: boolean
}

/**
 * Honest presentation of the backend's retrieval method. Recency is the
 * fallback used while embeddings are unavailable (Compatibility Report C3 /
 * deferred-RAG restriction) and MUST be labelled as recency — never as
 * semantic search / RAG. Only a backend that actually reports `semantic`
 * (embeddings configured) is shown as semantic.
 */
export function describeRetrievalMethod(method: RetrievalMethod): MethodPresentation {
  if (method === 'semantic') {
    return {
      label: 'Semantic',
      description: 'Ranked by meaning using embeddings.',
      variant: 'default',
      isFallback: false,
    }
  }
  return {
    label: 'Recency',
    description: 'Showing most recent matches — semantic search is unavailable (no embeddings configured).',
    variant: 'warning',
    isFallback: true,
  }
}
