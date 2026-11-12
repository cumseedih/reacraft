import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ActionCard } from './action-card'
import type { BotActionOut } from '@kroex/api'

function makeAction(over: Partial<BotActionOut>): BotActionOut {
  return {
    id: 'a1', action: 'memory.create', arguments: {}, status: 'proposed',
    result: null, error: null, conversation_id: 'c1', message_id: null,
    created_at: '2026-11-11T00:00:00Z', executed_at: null, ...over,
  }
}

describe('<ActionCard />', () => {
  it('shows Confirm/Reject only for proposed actions', () => {
    const { rerender } = render(<ActionCard action={makeAction({ status: 'proposed' })} onConfirm={() => {}} onReject={() => {}} />)
    expect(screen.getByTestId('confirm-btn')).toBeInTheDocument()
    rerender(<ActionCard action={makeAction({ status: 'executed' })} onConfirm={() => {}} onReject={() => {}} />)
    expect(screen.queryByTestId('confirm-btn')).not.toBeInTheDocument()
  })

  it('a NON-destructive proposed action confirms directly (no dialog)', () => {
    const onConfirm = vi.fn()
    render(<ActionCard action={makeAction({ action: 'memory.create', status: 'proposed' })} onConfirm={onConfirm} onReject={() => {}} />)
    expect(screen.queryByTestId('destructive-flag')).not.toBeInTheDocument()
    fireEvent.click(screen.getByTestId('confirm-btn'))
    expect(onConfirm).toHaveBeenCalledWith('a1')
  })

  it('a DESTRUCTIVE proposed action requires the confirmation dialog before executing', () => {
    const onConfirm = vi.fn()
    render(<ActionCard action={makeAction({ action: 'sandbox.exec', status: 'proposed' })} onConfirm={onConfirm} onReject={() => {}} />)
    // destructive flag shown
    expect(screen.getByTestId('destructive-flag')).toBeInTheDocument()
    // clicking Confirm does NOT immediately execute — it opens a dialog
    fireEvent.click(screen.getByTestId('confirm-btn'))
    expect(onConfirm).not.toHaveBeenCalled()
    // only the explicit dialog confirmation executes
    fireEvent.click(screen.getByTestId('confirm-destructive'))
    expect(onConfirm).toHaveBeenCalledWith('a1')
  })

  it('shows the error for a failed action', () => {
    render(<ActionCard action={makeAction({ status: 'failed', error: 'boom' })} onConfirm={() => {}} onReject={() => {}} />)
    expect(screen.getByText('boom')).toBeInTheDocument()
  })
})
