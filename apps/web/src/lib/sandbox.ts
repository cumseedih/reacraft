import { isSandboxSessionLive, type SnapshotRestoreState } from '@kroex/api'

export interface StatePresentation {
  label: string
  variant: 'default' | 'secondary' | 'muted' | 'warning' | 'success' | 'destructive'
  live: boolean
}

/** Honest session-state presentation (spec §1.9 — running/idle/provisioning are live). */
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
  variant: 'default' | 'secondary' | 'muted' | 'warning' | 'success' | 'destructive'
  inProgress: boolean
  complete: boolean
}

/**
 * restore_state presentation. A restore is only shown as done on `completed`
 * — the UI never claims success before the completed state arrives. While a
 * restore is queued/running, the caller must block session resume.
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
