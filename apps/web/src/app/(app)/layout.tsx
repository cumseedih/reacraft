import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: { default: 'Chat', template: '%s — KROEX' },
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {children}
    </div>
  )
}
