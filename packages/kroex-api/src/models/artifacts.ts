/** Source: API Integration Specification §1.6. There is no POST — artifacts are created only by the chat pipeline. */
import type { IsoDateTime } from './common.js'

export interface ArtifactOut {
  id: string
  conversation_id: string
  title: string
  type: string
  language?: string | null
  content: string
  created_at: IsoDateTime
}
