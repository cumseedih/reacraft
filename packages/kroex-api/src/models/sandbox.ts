/**
 * Source: API Integration Specification §1.9, §4.3, §6.
 * Flag-gated: sandbox_enabled (+ per-capability flags). 404 when off (§5.3).
 */
import type { IsoDateTime } from './common'

/**
 * Logical sandbox image names. IMPORTANT: "full" (kroex/sandbox-full:1) is
 * NOT built on staging (Sandbox Outstanding-Issues Report, "still open").
 * Per the Phase-4 directive ("Do not expose the unbuilt full sandbox
 * image"), callers MUST filter `full` out of any image picker built from
 * GET /api/sandbox/config — this package marks it explicitly so UI code
 * doesn't have to hard-code the exclusion.
 */
export const SANDBOX_LOGICAL_IMAGES = ['python', 'node', 'full'] as const
export type SandboxLogicalImage = (typeof SANDBOX_LOGICAL_IMAGES)[number]

/** Images confirmed built and session-verified on staging (Regression Report, Sandbox Report Issue 4). */
export const SANDBOX_BUILT_IMAGES: readonly SandboxLogicalImage[] = ['python', 'node']

export const SANDBOX_UNBUILT_IMAGE: SandboxLogicalImage = 'full'

/** Filters GET /api/sandbox/config's `images` list down to images that can actually provision. */
export function filterBuiltSandboxImages(images: readonly string[]): string[] {
  return images.filter((img) => img !== SANDBOX_UNBUILT_IMAGE)
}

/** Only the sandbox_* keys of the caller's plan limits (shape documented in §1.9, §4.3 table). */
export interface SandboxConfigOut {
  images: string[]
  default_image: string
  runtime: string
  limits: Record<string, number>
}

export interface WorkspaceCreate {
  /** 1-255 */
  name: string
  project_id?: string | null
}

/** confirm_name must equal the workspace name EXACTLY (422 otherwise). */
export interface WorkspaceDestroy {
  confirm_name: string
}

export interface WorkspaceOut {
  id: string
  project_id?: string | null
  name: string
  status: string
  quota_bytes: number
  size_bytes: number
  last_used_at?: IsoDateTime | null
  created_at: IsoDateTime
  updated_at: IsoDateTime
}

export type SandboxNetworkPolicy = 'none' | 'proxy'

export interface SessionCreate {
  workspace_id: string
  /** Logical name; defaults to 'python'. */
  image?: string
  /** 'proxy' requires sandbox_egress_enabled and an active grant at provision time. */
  network_policy?: SandboxNetworkPolicy
}

export interface SessionStop {
  reason?: string
}

/** Live states: running | idle | provisioning. Other observed states: stopped | destroyed | failed. */
export const SANDBOX_LIVE_STATES = ['provisioning', 'running', 'idle'] as const
export type SandboxLiveState = (typeof SANDBOX_LIVE_STATES)[number]

export function isSandboxSessionLive(state: string): boolean {
  return (SANDBOX_LIVE_STATES as readonly string[]).includes(state)
}

export interface SessionOut {
  id: string
  workspace_id: string
  image: string
  image_digest: string
  runtime: string
  kind: string
  state: string
  error?: string | null
  origin: string
  run_id?: string | null
  network_policy: string
  cpu_seconds: number
  peak_memory_mb: number
  last_activity_at?: IsoDateTime | null
  expires_at?: IsoDateTime | null
  created_at: IsoDateTime
  updated_at: IsoDateTime
}

export interface CommandCreate {
  /** 1-8192 chars */
  command: string
  cwd?: string
  /** 1-7200 seconds */
  timeout_seconds?: number | null
  /** Only 'api' / 'agent' are honoured server-side; anything else is coerced to 'api'. */
  origin?: 'api' | 'agent'
  run_id?: string | null
}

/** Terminal statuses (routers/sandbox.py:63). */
export const SANDBOX_COMMAND_TERMINAL_STATUSES = [
  'succeeded', 'failed', 'killed', 'timeout', 'cancelled',
] as const
export type SandboxCommandStatus = (typeof SANDBOX_COMMAND_TERMINAL_STATUSES)[number] | 'running' | 'queued'

export function isTerminalCommandStatus(status: string): boolean {
  return (SANDBOX_COMMAND_TERMINAL_STATUSES as readonly string[]).includes(status)
}

export interface CommandOut {
  id: string
  session_id: string
  origin: string
  command: string
  cwd: string
  status: string
  exit_code?: number | null
  duration_ms?: number | null
  bytes_out: number
  output_truncated: boolean
  run_id?: string | null
  bot_action_id?: string | null
  approval_id?: string | null
  started_at?: IsoDateTime | null
  finished_at?: IsoDateTime | null
  created_at: IsoDateTime
}

export interface SnapshotCreate {
  /** <= 255 */
  label?: string | null
}

export interface SnapshotOut {
  id: string
  workspace_id: string
  session_id?: string | null
  kind: string
  sha256: string
  size_bytes: number
  state: string
  created_at: IsoDateTime
}

export interface PatchOut {
  id: string
  workspace_id: string
  base_snapshot_id: string
  run_id: string
  session_id: string
  parent_run_id?: string | null
  source: string
  status: string
  diff: string
  files: Array<Record<string, unknown>>
  conflicts: Array<Record<string, unknown>>
  total_bytes: number
  applied_at?: IsoDateTime | null
  created_at: IsoDateTime
}

/** Entry shape from services/sandbox_egress.py: domain is exact hostname or "*.suffix" wildcard; ports defaults to [443]. */
export interface EgressPolicyEntry {
  domain: string
  ports?: number[]
}

export interface EgressPolicyCreate {
  /** 1-128 */
  name: string
  /** >= 1 entry */
  entries: EgressPolicyEntry[]
}

export interface EgressPolicyOut {
  id: string
  user_id: string
  name: string
  entries: EgressPolicyEntry[]
  created_at: IsoDateTime
}

export interface EgressGrantCreate {
  policy_id: string
  /** 60-86400 seconds */
  ttl_seconds?: number | null
}

export interface EgressGrantOut {
  id: string
  session_id: string
  policy_id: string
  granted_by: string
  expires_at?: IsoDateTime | null
  revoked_at?: IsoDateTime | null
  created_at: IsoDateTime
}

export interface ApprovalOut {
  id: string
  kind: string
  status: string
  payload: Record<string, unknown>
  payload_hash: string
  bot_action_id?: string | null
  session_id?: string | null
  workspace_id?: string | null
  run_id?: string | null
  decided_by?: string | null
  expires_at?: IsoDateTime | null
  created_at: IsoDateTime
  decided_at?: IsoDateTime | null
}
