'use client'
import { useRouter } from 'next/navigation'
import { AppShell } from '@/components/app-shell'
import { Composer } from '@/components/chat/composer'
import { useChatStore } from '@/store/chat'
import { useSettingsStore } from '@/store/settings'
import { generateId } from '@/lib/utils'

export default function ChatIndexPage() {
  const router = useRouter()
  const { addConversation } = useChatStore()
  const { defaultModel } = useSettingsStore()

  const handleSend = async (content: string, files: File[]) => {
    const id = generateId()
    addConversation({
      id,
      title: content.slice(0, 60) + (content.length > 60 ? '…' : ''),
      model: defaultModel ?? 'kroex-pro',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      pinned: false,
      archived: false,
    })
    router.push(`/chat/${id}?q=${encodeURIComponent(content)}`)
  }

  return (
    <AppShell>
      <div className="flex flex-col h-full">
        <div className="flex-1 flex flex-col items-center justify-center px-4 pb-16">
          <div className="text-center mb-10">
            <h1 className="text-3xl font-semibold mb-2">What can I help with?</h1>
            <p className="text-muted-foreground">Ask anything — KROEX thinks deeper, builds further.</p>
          </div>
          <div className="grid grid-cols-2 gap-2 max-w-lg w-full mb-8">
            {[
              'Explain quantum entanglement simply',
              'Write a Python web scraper',
              'Help me plan a product launch',
              'Debug this TypeScript error',
            ].map(p => (
              <button
                key={p}
                onClick={() => handleSend(p, [])}
                className="text-left p-3 rounded-xl border border-border hover:border-primary/40 hover:bg-secondary/60 transition-all text-sm text-muted-foreground hover:text-foreground"
              >
                {p}
              </button>
            ))}
          </div>
        </div>
        <Composer
          onSend={handleSend}
          model={defaultModel ?? 'kroex-pro'}
        />
      </div>
    </AppShell>
  )
}
