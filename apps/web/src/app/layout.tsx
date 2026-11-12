import type { Metadata, Viewport } from 'next'
import { Inter, Lora, JetBrains_Mono } from 'next/font/google'
import { ThemeProvider } from '@/components/providers/theme-provider'
import { QueryProvider } from '@/components/providers/query-provider'
import { Toaster } from 'sonner'
import '@/styles/globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})
const lora = Lora({
  subsets: ['latin'],
  variable: '--font-lora',
  display: 'swap',
})
const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains',
  display: 'swap',
})

export const metadata: Metadata = {
  title: { default: 'KROEX', template: '%s — KROEX' },
  description: 'Think deeper. Build further. KROEX is a powerful AI assistant for problem solvers.',
  keywords: ['AI', 'assistant', 'chat', 'KROEX', 'artificial intelligence'],
  authors: [{ name: 'KROEX Team' }],
  creator: 'KROEX',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://kroex.ai',
    siteName: 'KROEX',
    title: 'KROEX — Think deeper. Build further.',
    description: 'A powerful AI assistant for problem solvers.',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'KROEX' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'KROEX',
    description: 'Think deeper. Build further.',
    creator: '@kroex_ai',
  },
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon-16x16.png',
    apple: '/apple-touch-icon.png',
  },
  manifest: '/site.webmanifest',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#FAFAF8' },
    { media: '(prefers-color-scheme: dark)', color: '#191919' },
  ],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${lora.variable} ${jetbrainsMono.variable}`}
    >
      <body className="min-h-screen bg-background font-sans antialiased">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <QueryProvider>
            {children}
            <Toaster
              position="bottom-right"
              toastOptions={{
                classNames: {
                  toast: 'bg-card border border-border text-foreground shadow-lg',
                  description: 'text-muted-foreground',
                  actionButton: 'bg-primary text-primary-foreground',
                  cancelButton: 'bg-muted text-muted-foreground',
                },
              }}
            />
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
