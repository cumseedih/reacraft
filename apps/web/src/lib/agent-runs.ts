import { isTerminalRunStatus } from '@kroex/api'

export interface RunStatusPresentation {
  label: string
  variant: 'default' | 'secondary' | 'muted' | 'warning' | 'success' | 'destructive'
  isTerminal: boolean
  inProgress: boolean
}

/**
 * Honest run-status presentation (spec §1.8). A run is only "succeeded" when
 * the backend reports that terminal status — the UI never claims success
 * before the completed state arrives.
 */
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
