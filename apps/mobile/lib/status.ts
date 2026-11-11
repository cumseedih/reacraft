import {
  BOT_ACTION_REGISTRY,
  isTerminalRunStatus,
  isSandboxSessionLive,
  type MemorySearchResult,
  type SnapshotRestoreState,
} from '@kroex/api'

/**
 * Shared status/presentation logic for the mobile app. The variant strings
 * match the web app's exactly so the two surfaces stay semantically aligned;
 * the Badge component maps a variant to a mobile color token. All functions
 * here are pure and unit-tested (see __tests__/status.test.ts).
 */
export type BadgeVariant =
  | 'default'
  | 'secondary'
  | 'muted'
  | 'warning'
  | 'success'
  | 'destructive'

// ---------------------------------------------------------------------------
// Memory retrieval method (honest recency-vs-semantic display)
// ---------------------------------------------------------------------------
export type RetrievalMethod = MemorySearchResult['method']

export interface MethodPresentation {
  label: string
  description: string
  variant: BadgeVariant
  isFallback: boolean
}

/**
 * Recency is the fallback used while embeddings are unavailable and MUST be
 * labelled as recency — never as semantic search / RAG. Only a backend that
 * actually reports `semantic` is shown as semantic.
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

// ---------------------------------------------------------------------------
// BOT actions (destructive gating + status)
// ---------------------------------------------------------------------------
/**
 * Whether a BOT action requires explicit confirmation. Source of truth is the
 * backend registry re-exported by @kroex/api. Unknown actions default to
 * requiring confirmation — we never auto-trust an unrecognised action and
 * never add a trusted-command bypass.
 */
export function isDestructiveAction(action: string): boolean {
  const entry = (BOT_ACTION_REGISTRY as Record<string, { requiresConfirmation: boolean } | undefined>)[action]
  return entry ? entry.requiresConfirmation : true
}

export interface ActionStatusPresentation {
  label: string
  variant: BadgeVariant
  awaitingDecision: boolean
}

export function describeActionStatus(status: string): ActionStatusPresentation {
  switch (status) {
    case 'proposed':  return { label: 'Proposed', variant: 'warning', awaitingDecision: true }
    case 'confirmed': return { label: 'Confirmed', variant: 'default', awaitingDecision: false }
    case 'executed':  return { label: 'Executed', variant: 'success', awaitingDecision: false }
    case 'failed':    return { label: 'Failed', variant: 'destructive', awaitingDecision: false }
    case 'rejected':  return { label: 'Rejected', variant: 'muted', awaitingDecision: false }
    default:          return { label: status, variant: 'muted', awaitingDecision: false }
  }
}

// ---------------------------------------------------------------------------
// Agent runs (never "succeeded" before terminal)
// ---------------------------------------------------------------------------
export interface RunStatusPresentation {
  label: string
  variant: BadgeVariant
  isTerminal: boolean
  inProgress: boolean
}

export function describeRunStatus(status: string): RunStatusPresentation {
  const terminal = isTerminalRunStatus(status)
  switch (status) {
    case 'queued':    return { label: 'Queued', variant: 'muted', isTerminal: false, inProgress: true }
    case 'running':   return { label: 'Running', variant: 'warning', isTerminal: false, inProgress: true }
    case 'succeeded': return { label: 'Succeeded', variant: 'success', isTerminal: true, inProgress: false }
    case 'failed':    return { label: 'Failed', variant: 'destructive', isTerminal: true, inProgress: false }
    case 'cancelled': return { label: 'Cancelled', variant: 'muted', isTerminal: true, inProgress: false }
    case 'dead':      return { label: 'Dead', variant: 'destructive', isTerminal: true, inProgress: false }
    default:          return { label: status, variant: 'secondary', isTerminal: terminal, inProgress: !terminal }
  }
}

// ---------------------------------------------------------------------------
// Sandbox session + snapshot restore state
// ---------------------------------------------------------------------------
export interface StatePresentation {
  label: string
  variant: BadgeVariant
  live: boolean
}

export function describeSessionState(state: string): StatePresentation {
  switch (state) {
    case 'provisioning': return { label: 'Provisioning', variant: 'warning', live: true }
    case 'running':      return { label: 'Running', variant: 'success', live: true }
    case 'idle':         return { label: 'Idle', variant: 'secondary', live: true }
    case 'stopped':      return { label: 'Stopped', variant: 'muted', live: false }
    case 'failed':       return { label: 'Failed', variant: 'destructive', live: false }
    case 'destroyed':    return { label: 'Destroyed', variant: 'muted', live: false }
    default:             return { label: state, variant: 'muted', live: isSandboxSessionLive(state) }
  }
}

export interface RestorePresentation {
  label: string
  variant: BadgeVariant
  inProgress: boolean
  complete: boolean
}

/**
 * A restore is only shown as done on `completed` — the UI never claims success
 * before the completed state arrives. While queued/running, callers must block
 * session resume.
 */
export function describeRestoreState(state: SnapshotRestoreState | null | undefined): RestorePresentation {
  switch (state) {
    case 'queued':    return { label: 'Queued', variant: 'muted', inProgress: true, complete: false }
    case 'running':   return { label: 'Restoring', variant: 'warning', inProgress: true, complete: false }
    case 'completed': return { label: 'Completed', variant: 'success', inProgress: false, complete: true }
    case 'failed':    return { label: 'Failed', variant: 'destructive', inProgress: false, complete: false }
    case 'idle':
    default:          return { label: 'Idle', variant: 'muted', inProgress: false, complete: false }
  }
}

// ---------------------------------------------------------------------------
// Command status (sandbox exec)
// ---------------------------------------------------------------------------
export function describeCommandStatus(status: string): { label: string; variant: BadgeVariant; inProgress: boolean } {
  switch (status) {
    case 'queued':    return { label: 'Queued', variant: 'muted', inProgress: true }
    case 'running':   return { label: 'Running', variant: 'warning', inProgress: true }
    case 'succeeded': return { label: 'Succeeded', variant: 'success', inProgress: false }
    case 'failed':    return { label: 'Failed', variant: 'destructive', inProgress: false }
    case 'killed':    return { label: 'Killed', variant: 'destructive', inProgress: false }
    case 'timeout':   return { label: 'Timed out', variant: 'destructive', inProgress: false }
    case 'cancelled': return { label: 'Cancelled', variant: 'muted', inProgress: false }
    default:          return { label: status, variant: 'secondary', inProgress: false }
  }
}
