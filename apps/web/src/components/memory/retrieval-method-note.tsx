import { Badge } from '@/components/ui/badge'
import { describeRetrievalMethod, type RetrievalMethod } from '@/lib/memory-method'

/**
 * Renders an honest indicator of how memory search ranked its results.
 * Recency (the fallback used while embeddings are unavailable) is always
 * labelled as recency and never presented as semantic search / RAG.
 */
export function RetrievalMethodNote({ method }: { method: RetrievalMethod }) {
  const m = describeRetrievalMethod(method)
  return (
    <div className="flex items-start gap-2" data-testid="retrieval-method-note">
      <Badge variant={m.variant} data-testid="method-badge">{m.label}</Badge>
      <p className="text-xs text-muted-foreground" data-testid="method-description">{m.description}</p>
    </div>
  )
}
