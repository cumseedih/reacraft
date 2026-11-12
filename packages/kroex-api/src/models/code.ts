/**
 * Source: API Integration Specification §1.10.
 * IMPORTANT: this surface is DISABLED on staging (code_enabled=false) and
 * must stay disabled per the Phase-4 directive ("Keep Code Reviews
 * disabled"). Types are inventoried here for contract completeness only —
 * no UI should call these endpoints while the flag is off (they 404).
 */
import type { IsoDateTime } from './common'

export interface ConnectionCreate {
  /** 1-255 */
  name: string
  token: string
  webhook_secret?: string | null
}

export interface ConnectionOut {
  id: string
  provider: string
  name: string
  account_login?: string | null
  hosting_mode: string
  enabled: boolean
  created_at: IsoDateTime
  updated_at: IsoDateTime
}

/** Returned exactly once, at creation. Never persisted/re-fetchable. */
export interface ConnectionCreatedOut extends ConnectionOut {
  webhook_secret: string
}

export interface RepositoryCreate {
  full_name: string
  review_model?: string
  enabled?: boolean
}

export interface RepositoryUpdate {
  review_model?: string | null
  enabled?: boolean | null
}

export interface RepositoryOut {
  id: string
  connection_id: string
  full_name: string
  review_model: string
  hosting_mode: string
  enabled: boolean
  created_at: IsoDateTime
  updated_at: IsoDateTime
}

export interface ManualReviewRequest {
  /** > 0 */
  pr_number: number
}

export interface ReviewOut {
  id: string
  repository_id: string
  pr_number: number
  status: string
  model: string
  summary?: string | null
  delivery_status?: string | null
  error?: string | null
  created_at: IsoDateTime
}

export interface ReviewCommentOut {
  id: string
  path: string
  position?: number | null
  severity: string
  body: string
  created_at: IsoDateTime
}
