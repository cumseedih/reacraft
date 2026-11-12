import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PatchCard } from './patch-card'
import type { PatchOut } from '@kroex/api'

function makePatch(over: Partial<PatchOut>): PatchOut {
  return {
    id: 'p1', workspace_id: 'w1', base_snapshot_id: 's1', run_id: 'r1',
    session_id: 'sess1', parent_run_id: null, source: 'agent', status: 'proposed',
    diff: '--- a\n+++ b\n@@ -1 +1 @@\n-old\n+new', files: [], conflicts: [],
    total_bytes: 12, applied_at: null, created_at: '2026-11-11T00:00:00Z', ...over,
  }
}

describe('<PatchCard />', () => {
  it('renders the diff', () => {
    render(<PatchCard patch={makePatch({})} onApply={() => {}} onReject={() => {}} />)
    expect(screen.getByTestId('patch-diff').textContent).toContain('+new')
  })

  it('NEVER auto-applies: Apply requires an explicit confirmation dialog', () => {
    const onApply = vi.fn()
    render(<PatchCard patch={makePatch({ status: 'proposed' })} onApply={onApply} onReject={() => {}} />)
    fireEvent.click(screen.getByTestId('apply-btn'))
    // clicking Apply opens a dialog; it has NOT applied yet
    expect(onApply).not.toHaveBeenCalled()
    fireEvent.click(screen.getByTestId('confirm-apply'))
    expect(onApply).toHaveBeenCalledWith('p1')
  })

  it('does not offer Apply/Reject once the patch is applied', () => {
    render(<PatchCard patch={makePatch({ status: 'applied' })} onApply={() => {}} onReject={() => {}} />)
    expect(screen.queryByTestId('apply-btn')).not.toBeInTheDocument()
  })
})
