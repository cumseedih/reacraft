import { BOT_ACTION_REGISTRY } from '@kroex/api'

/**
 * Whether a BOT action requires explicit confirmation before it executes.
 * Source of truth is the backend action registry (spec §1.7), re-exported by
 * @kroex/api. Unknown action names default to requiring confirmation — we
 * never auto-trust an action the client doesn't recognise, and we never add a
 * trusted-command bypass.
 */
export function isDestructiveAction(action: string): boolean {
  const entry = (BOT_ACTION_REGISTRY as Record<string, { requiresConfirmation: boolean } | undefined>)[action]
  return entry ? entry.requiresConfirmation : true
}

export interface ActionStatusPresentation {
  label: string
  variant: 'default' | 'secondary' | 'muted' | 'warning' | 'success' | 'destructive'
  /** Proposed actions await the user's confirm/reject decision. */
  awaitingDecision: boolean
}

/**
 * Honest status presentation. Preserves the distinction between proposed,
 * confirmed, rejected, executed and failed actions.
 */
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
