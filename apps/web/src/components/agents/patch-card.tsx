'use client'
import { useState } from 'react'
import { GitBranch, Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import type { PatchOut } from '@kroex/api'

/**
 * Displays an agent-proposed patch and its diff. Apply is an explicit,
 * confirmed owner action (spec §1.9) — a proposed patch is NEVER auto-applied
 * by this UI. Apply/Reject are only offered while the patch is still pending.
 */
export function PatchCard({
  patch, onApply, onReject, busy,
}: {
  patch: PatchOut
  onApply: (id: string) => void
  onReject: (id: string) => void
  busy?: boolean
}) {
  const [confirmApply, setConfirmApply] = useState(false)
  const pending = patch.status === 'proposed' || patch.status === 'pending' || patch.status === 'ready'

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden" data-testid="patch-card">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border">
        <GitBranch className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium">Proposed patch</span>
        <Badge variant="muted" className="capitalize" data-testid="patch-status">{patch.status}</Badge>
        {patch.total_bytes > 0 && <span className="text-xs text-muted-foreground ml-auto">{patch.total_bytes} bytes</span>}
      </div>

      {patch.diff ? (
        <pre className="max-h-64 overflow-auto p-3 text-xs font-mono leading-relaxed bg-secondary/30" data-testid="patch-diff"><code>{patch.diff}</code></pre>
      ) : (
        <p className="px-4 py-3 text-xs text-muted-foreground">No diff available for this patch.</p>
      )}

      {patch.conflicts && patch.conflicts.length > 0 && (
        <p className="px-4 py-2 text-xs text-destructive border-t border-border">{patch.conflicts.length} conflict(s) — review before applying.</p>
      )}

      {pending && (
        <div className="flex items-center gap-2 px-4 py-3 border-t border-border">
          <Button size="sm" className="gap-1.5" disabled={busy} onClick={() => setConfirmApply(true)} data-testid="apply-btn">
            <Check className="h-3.5 w-3.5" /> Apply
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5" disabled={busy} onClick={() => onReject(patch.id)} data-testid="reject-btn">
            <X className="h-3.5 w-3.5" /> Reject
          </Button>
          <span className="text-xs text-muted-foreground ml-auto">Applying changes the workspace. It runs only when you confirm.</span>
        </div>
      )}

      <Dialog open={confirmApply} onOpenChange={setConfirmApply}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Apply this patch?</DialogTitle>
            <DialogDescription>This will apply the diff to the workspace. It cannot be undone automatically.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmApply(false)}>Cancel</Button>
            <Button data-testid="confirm-apply" onClick={() => { setConfirmApply(false); onApply(patch.id) }}>Apply patch</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
