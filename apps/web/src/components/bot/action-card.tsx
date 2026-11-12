'use client'
import { useState } from 'react'
import { ShieldAlert, Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { describeActionStatus, isDestructiveAction } from '@/lib/bot-actions'
import type { BotActionOut } from '@kroex/api'

interface ActionCardProps {
  action: BotActionOut
  onConfirm: (id: string) => void
  onReject: (id: string) => void
  busy?: boolean
}

/**
 * Renders a single BOT action with its status and, when proposed, the
 * confirm/reject controls. Destructive actions (per the backend registry)
 * ALWAYS route Confirm through an explicit confirmation dialog — there is no
 * trusted-command bypass and no auto-execution.
 */
export function ActionCard({ action, onConfirm, onReject, busy }: ActionCardProps) {
  const status = describeActionStatus(action.status)
  const destructive = isDestructiveAction(action.action)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const handleConfirmClick = () => {
    if (destructive) setConfirmOpen(true)
    else onConfirm(action.id)
  }

  return (
    <div className="rounded-xl border border-border bg-card p-3" data-testid="action-card">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <code className="text-sm font-mono font-medium">{action.action}</code>
            <Badge variant={status.variant} data-testid="action-status">{status.label}</Badge>
            {destructive && (
              <Badge variant="outline" className="gap-1 text-destructive border-destructive/40" data-testid="destructive-flag">
                <ShieldAlert className="h-3 w-3" /> Needs confirmation
              </Badge>
            )}
          </div>
          {Object.keys(action.arguments ?? {}).length > 0 && (
            <pre className="mt-2 text-xs bg-secondary/50 rounded-lg p-2 overflow-x-auto"><code>{JSON.stringify(action.arguments, null, 2)}</code></pre>
          )}
          {action.error && <p className="mt-2 text-xs text-destructive">{action.error}</p>}
          {action.result && action.status === 'executed' && (
            <pre className="mt-2 text-xs bg-secondary/50 rounded-lg p-2 overflow-x-auto"><code>{JSON.stringify(action.result, null, 2)}</code></pre>
          )}
        </div>
      </div>

      {status.awaitingDecision && (
        <div className="flex items-center gap-2 mt-3">
          <Button size="sm" className="gap-1.5" disabled={busy} onClick={handleConfirmClick} data-testid="confirm-btn">
            <Check className="h-3.5 w-3.5" /> Confirm
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5" disabled={busy} onClick={() => onReject(action.id)} data-testid="reject-btn">
            <X className="h-3.5 w-3.5" /> Reject
          </Button>
        </div>
      )}

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Confirm {action.action}?</DialogTitle>
            <DialogDescription>
              This is a destructive action. It will run only after you confirm.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmOpen(false)}>Cancel</Button>
            <Button variant="destructive" data-testid="confirm-destructive" onClick={() => { setConfirmOpen(false); onConfirm(action.id) }}>
              Confirm &amp; run
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
