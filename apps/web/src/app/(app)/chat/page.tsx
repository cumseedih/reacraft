'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { AppShell } from '@/components/app-shell'
import { Composer } from '@/components/chat/composer'
import { useChatStore } from '@/store/chat'
import { useSettingsStore } from '@/store/settings'
import { chatStream, getApiError } from '@/lib/api'
import { generateId } from '@/lib/utils'

export default function ChatIndexPage() {
  const router = useRouter()
  const { addConversation, addMessage, appendMessageContent, updateMessage, setStreaming } = useChatStore()
  const { defaultModel } = useSettingsStore()
  const [isStarting, setIsStarting] = useState(false)

  const handleSend = async (content: string, _files: File[]) => {
    if (!content.trim() || isStarting) return
    setIsStarting(true)

    const model = defaultModel ?? 'kroex-pro'

    try {
      // Stream to backend without conversation_id — backend creates the conversation.
      const { conversationId, generator } = await chatStream({
        message: content,
        messages: [{ role: 'user', content }],
        model,
      })

      if (!conversationId) throw new Error('Server did not return a conversation ID')

      const userMsgId = generateId()
      const asstMsgId = generateId()

      addConversation({
        id: conversationId,
        title: content.slice(0, 60) + (content.length > 60 ? '…' : ''),
        model,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        pinned: false,
        archived: false,
      })

      addMessage(conversationId, {
        id: userMsgId,
        conversationId,
        role: 'user',
        content,
        status: 'done',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })

      addMessage(conversationId, {
        id: asstMsgId,
        conversationId,
        role: 'assistant',
        content: '',
        status: 'streaming',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })

      setStreaming(true, asstMsgId)

      // Navigate immediately — the Zustand store updates will reach the new page
      // as the stream continues processing below.
      router.push(`/chat/${conversationId}`)

      for await (const line of generator) {
        try {
          const data = JSON.parse(line)
          if (data.type === 'delta' && data.text) {
            appendMessageContent(conversationId, asstMsgId, data.text)
          } else if (data.type === 'done') {
            updateMessage(conversationId, asstMsgId, {
              status: 'done',
              tokens: data.usage,
              model: data.model,
            })
          } else if (data.type === 'error') {
            throw new Error(data.message)
          }
        } catch {
          // ignore JSON parse errors on individual lines
        }
      }
    } catch (err: unknown) {
      toast.error(getApiError(err))
    } finally {
      setIsStarting(false)
      setStreaming(false)
    }
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
                disabled={isStarting}
                className="text-left p-3 rounded-xl border border-border hover:border-primary/40 hover:bg-secondary/60 transition-all text-sm text-muted-foreground hover:text-foreground disabled:opacity-50"
              >
                {p}
              </button>
            ))}
          </div>
        </div>
        <Composer
          onSend={handleSend}
          model={defaultModel ?? 'kroex-pro'}
          isStreaming={isStarting}
        />
      </div>
    </AppShell>
  )
}
