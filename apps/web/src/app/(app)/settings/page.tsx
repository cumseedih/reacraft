'use client'
import { useState } from 'react'
import { AppShell } from '@/components/app-shell'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { useSettingsStore } from '@/store/settings'
import { useAuthStore } from '@/store/auth'
import { cn } from '@/lib/utils'

const SECTIONS = [
  { id: 'general', label: 'General' },
  { id: 'appearance', label: 'Appearance' },
  { id: 'models', label: 'Models' },
  { id: 'account', label: 'Account' },
]

export default function SettingsPage() {
  const [section, setSection] = useState('general')
  const settings = useSettingsStore()
  const { user } = useAuthStore()

  return (
    <AppShell>
      <div className="flex h-full">
        <div className="w-48 border-r border-border p-4 shrink-0">
          <h2 className="text-sm font-semibold mb-3 px-2">Settings</h2>
          <nav className="space-y-0.5">
            {SECTIONS.map(s => (
              <button
                key={s.id}
                onClick={() => setSection(s.id)}
                className={cn(
                  'w-full text-left px-2 py-1.5 rounded-lg text-sm transition-colors',
                  section === s.id
                    ? 'bg-secondary text-foreground'
                    : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                )}
              >
                {s.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="flex-1 overflow-y-auto p-8 max-w-2xl">
          {section === 'general' && (
            <section className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-1">General</h3>
                <p className="text-sm text-muted-foreground">Manage your KROEX preferences</p>
              </div>
              <Separator />
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Enter to send</p>
                    <p className="text-xs text-muted-foreground">Press Enter to send messages (Shift+Enter for newline)</p>
                  </div>
                  <button
                    onClick={() => settings.update({ enterToSend: !settings.enterToSend })}
                    className={cn('relative h-6 w-11 rounded-full transition-colors', settings.enterToSend ? 'bg-primary' : 'bg-muted')}
                  >
                    <div className={cn('absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform', settings.enterToSend && 'translate-x-5')} />
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Show token count</p>
                    <p className="text-xs text-muted-foreground">Display token usage for each response</p>
                  </div>
                  <button
                    onClick={() => settings.update({ showTokenCount: !settings.showTokenCount })}
                    className={cn('relative h-6 w-11 rounded-full transition-colors', settings.showTokenCount ? 'bg-primary' : 'bg-muted')}
                  >
                    <div className={cn('absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform', settings.showTokenCount && 'translate-x-5')} />
                  </button>
                </div>
              </div>
            </section>
          )}

          {section === 'appearance' && (
            <section className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-1">Appearance</h3>
                <p className="text-sm text-muted-foreground">Customize how KROEX looks</p>
              </div>
              <Separator />
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium mb-2">Theme</p>
                  <div className="flex gap-2">
                    {(['light', 'dark', 'system'] as const).map(t => (
                      <button key={t} onClick={() => settings.update({ theme: t })}
                        className={cn('px-4 py-2 rounded-xl text-sm capitalize border transition-colors',
                          settings.theme === t ? 'border-primary bg-primary/8 text-primary' : 'border-border text-muted-foreground hover:bg-secondary')}>
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium mb-2">Font size</p>
                  <div className="flex gap-2">
                    {(['sm', 'md', 'lg'] as const).map(s => (
                      <button key={s} onClick={() => settings.update({ fontSize: s })}
                        className={cn('px-4 py-2 rounded-xl text-sm border transition-colors',
                          settings.fontSize === s ? 'border-primary bg-primary/8 text-primary' : 'border-border text-muted-foreground hover:bg-secondary')}>
                        {s === 'sm' ? 'Small' : s === 'md' ? 'Medium' : 'Large'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          )}

          {section === 'models' && (
            <section className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-1">Models</h3>
                <p className="text-sm text-muted-foreground">Configure default model and provider</p>
              </div>
              <Separator />
              <div>
                <p className="text-sm font-medium mb-2">Default model</p>
                <div className="space-y-2">
                  {['kroex-ultra', 'kroex-pro', 'kroex-fast'].map(m => (
                    <button key={m} onClick={() => settings.update({ defaultModel: m })}
                      className={cn('w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-colors',
                        settings.defaultModel === m ? 'border-primary bg-primary/8' : 'border-border hover:bg-secondary')}>
                      <div className="flex-1">
                        <p className="text-sm font-medium capitalize">{m.replace('kroex-', 'KROEX ')}</p>
                      </div>
                      {settings.defaultModel === m && <div className="h-2 w-2 rounded-full bg-primary" />}
                    </button>
                  ))}
                </div>
              </div>
            </section>
          )}

          {section === 'account' && (
            <section className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-1">Account</h3>
                <p className="text-sm text-muted-foreground">Manage your account details</p>
              </div>
              <Separator />
              <div className="space-y-4">
                <div className="flex items-center gap-4 p-4 bg-secondary/40 rounded-xl">
                  <div className="flex-1">
                    <p className="text-sm font-medium">{user?.name}</p>
                    <p className="text-sm text-muted-foreground">{user?.email}</p>
                  </div>
                  <Badge variant="secondary" className="capitalize">{user?.plan ?? 'free'}</Badge>
                </div>
              </div>
            </section>
          )}
        </div>
      </div>
    </AppShell>
  )
}
