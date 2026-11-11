import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { RetrievalMethodNote } from './retrieval-method-note'

describe('<RetrievalMethodNote />', () => {
  it('renders a Recency badge and an "unavailable" note for the recency fallback', () => {
    render(<RetrievalMethodNote method="recency" />)
    expect(screen.getByTestId('method-badge')).toHaveTextContent('Recency')
    expect(screen.getByTestId('method-description').textContent?.toLowerCase()).toContain('unavailable')
    // The UI must never present recency as semantic search.
    expect(screen.getByTestId('method-badge')).not.toHaveTextContent('Semantic')
  })

  it('renders a Semantic badge only when the method is semantic', () => {
    render(<RetrievalMethodNote method="semantic" />)
    expect(screen.getByTestId('method-badge')).toHaveTextContent('Semantic')
  })
})
