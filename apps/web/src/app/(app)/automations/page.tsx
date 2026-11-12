import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Automations' }

export default function AutomationsPage() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
      </svg>
      <p className="text-lg font-medium">Automations</p>
      <p className="text-sm">Coming soon</p>
    </div>
  )
}
