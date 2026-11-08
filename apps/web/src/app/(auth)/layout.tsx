import Image from 'next/image'
import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: { default: 'Sign in', template: '%s — KROEX' },
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex lg:w-[45%] bg-secondary/40 flex-col items-center justify-center p-12 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent" />
        <div className="relative z-10 text-center">
          <div className="flex justify-center mb-6">
            <Image src="/assets/kroex-raven.png" alt="KROEX" width={72} height={72} className="rounded-2xl shadow-xl" />
          </div>
          <h1 className="text-4xl font-semibold mb-3 tracking-tight">KROEX</h1>
          <p className="text-lg text-muted-foreground max-w-xs">Think deeper. Build further.</p>
          <div className="mt-10 grid grid-cols-1 gap-3 max-w-xs">
            {[
              '200K token context window',
              'Multi-model AI routing',
              'Artifact generation',
              'Web research & synthesis',
            ].map(feat => (
              <div key={feat} className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                {feat}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex justify-center mb-8">
            <Link href="/" className="flex items-center gap-2">
              <Image src="/assets/kroex-raven.png" alt="KROEX" width={36} height={36} className="rounded-xl" />
              <span className="text-xl font-semibold">KROEX</span>
            </Link>
          </div>
          {children}
        </div>
      </div>
    </div>
  )
}
