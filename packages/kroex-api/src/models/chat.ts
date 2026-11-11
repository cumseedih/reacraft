/** Source: API Integration Specification §1.2. */
import type { IsoDateTime } from './common'

export interface StreamRequest {
  message: string
  model?: string
  conversation_id?: string | null
  project_id?: string | null
  /** Client-supplied history; server appends the new user message and windows server-side. */
  messages?: Array<Record<string, unknown>>
}

export interface ConversationOut {
  id: string
  title: string
  model: string
  kind: string
  created_at: IsoDateTime
  updated_at: IsoDateTime
}

export interface MessageOut {
  id: string
  role: string
  content: string
  created_at: IsoDateTime
}
