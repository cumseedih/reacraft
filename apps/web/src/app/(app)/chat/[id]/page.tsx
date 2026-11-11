'use client'
import { useEffect, useRef, useCallback, useState } from 'react'
import { useParams } from 'next/navigation'
import { AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { AppShell } from '@/components/app-shell'
import { ChatMessage } from '@/components/chat/chat-message'
import { Composer } from '@/components/chat/composer'
import { ArtifactPanel } from '@/components/artifacts/artifact-panel'
import { ModelSelector } from '@/components/models/model-selector'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useChatStore } from '@/store/chat'
import { useSettingsStore } from '@/store/settings'
import { chatStreamEvents, get, getApiError } from '@/lib/api'
import { generateId } from '@/lib/utils'
import type { Message, Artifact } from '@/types'

// Backend returns snake_case Message fields; map to frontend type.
function mapMessage(raw: Record<string, unknown>, convId: string): Message {
  return {
    id: raw.id as string,
    conversationId: convId,
    role: raw.role as 'user' | 'assistant',
    content: raw.content as string,
    status: 'done',
    createdAt: raw.created_at as string,
    updatedAt: raw.created_at as string,
  }
}

export default function ChatPage() {
  const { id } = useParams<{ id: string }>()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const loadedRef = useRef<Set<string>>(new Set())
  const [modelSelectorOpen, setModelSelectorOpen] = useState(false)

  const {
    messages, setMessages, addMessage, updateMessage, appendMessageContent,
    conversations, updateConversation, setActiveConversation,
    artifacts, activeArtifactId, setActiveArtifact,
    isStreaming, setStreaming,
  } = useChatStore()

  const { defaultModel } = useSettingsStore()

  const conversation = conversations.find(c => c.id === id)
  const chatMessages = messages[id] ?? []
  const activeArtifact = activeArtifactId ? artifacts[activeArtifactId] : null

  useEffect(() => {
    if (id) setActiveConversation(id)
  }, [id, setActiveConversation])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages.length])

  // Load messages from backend when navigating to an existing conversation
  // that doesn't yet have its history in the store.
  useEffect(() => {
    if (!id || loadedRef.current.has(id)) return
    // If messages are already populated (e.g. navigated from new-chat flow), skip.
    if (messages[id] && messages[id].length > 0) {
      loadedRef.current.add(id)
      return
    }
    loadedRef.current.add(id)
    get<Record<string, unknown>[]>(`/api/conversations/${id}/messages`)
      .then(raw => setMessages(id, raw.map(r => mapMessage(r, id))))
      .catch(() => {
        // 401 handled globally; 404 means conversation was deleted.
      })
  }, [id, messages, setMessages])

  const handleSend = useCallback(async (content: string, _files: File[]) => {
    if (!content.trim()) return

    const asstMsgId = generateId()
    const userMsgId = generateId()

    addMessage(id, {
      id: userMsgId,
      conversationId: id,
      role: 'user',
      content,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'done',
    })

    addMessage(id, {
      id: asstMsgId,
      conversationId: id,
      role: 'assistant',
      content: '',
      model: conversation?.model ?? defaultModel ?? 'kroex-pro',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'streaming',
    })

    setStreaming(true, asstMsgId)

    const history = chatMessages.map(m => ({
      role: m.role,
      content: typeof m.content === 'string' ? m.content : '',
    }))

    abortRef.current = new AbortController()

    try {
      const { events } = await chatStreamEvents(
        {
          message: content,
          messages: [...history, { role: 'user', content }],
          model: conversation?.model ?? defaultModel ?? 'kroex-pro',
          conversation_id: id,
        },
        abortRef.current.signal,
      )

      // Events are already parsed and discriminated by the shared
      // @kroex/api parser (spec §2.1), so no per-line JSON handling here.
      for await (const event of events) {
        if (event.type === 'delta') {
          appendMessageContent(id, asstMsgId, event.text)
        } else if (event.type === 'artifact') {
          const artifact = event.artifact as unknown as Artifact
          useChatStore.getState().addArtifact(artifact)
          setActiveArtifact(artifact.id)
        } else if (event.type === 'done') {
          updateMessage(id, asstMsgId, {
            status: 'done',
            tokens: event.usage,
            model: event.model,
          })
          updateConversation(id, { updatedAt: new Date().toISOString() })
        } else if (event.type === 'error') {
          // In-stream failures keep HTTP 200 (spec §9 guidance #6).
          throw new Error(event.message)
        }
      }
    } catch (err: unknown) {
      if ((err as Error).name === 'AbortError') {
        updateMessage(id, asstMsgId, { status: 'done' })
      } else {
        updateMessage(id, asstMsgId, { status: 'error' })
        toast.error(getApiError(err))
      }
    } finally {
      setStreaming(false)
      abortRef.current = null
    }
  }, [id, chatMessages, conversation, defaultModel, addMessage, updateMessage, appendMessageContent, updateConversation, setStreaming, setActiveArtifact])

  const handleStop = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  const handleRegenerate = useCallback(async (msgId: string) => {
    const idx = chatMessages.findIndex(m => m.id === msgId)
    if (idx < 1) return
    const prevUserMsg = chatMessages.slice(0, idx).reverse().find(m => m.role === 'user')
    if (!prevUserMsg) return
    const content = typeof prevUserMsg.content === 'string' ? prevUserMsg.content : ''
    await handleSend(content, [])
  }, [chatMessages, handleSend])

  return (
    <AppShell>
      <div className="flex h-full">
        <div className={`relative flex flex-col flex-1 min-w-0 transition-all duration-300 ${activeArtifact ? 'max-w-[55%]' : ''}`}>
          {chatMessages.length === 0 ? (
            <WelcomeScreen
              onSend={handleSend}
              model={conversation?.model ?? defaultModel ?? 'kroex-pro'}
              onModelClick={() => setModelSelectorOpen(true)}
            />
          ) : (
            <>
              <ScrollArea className="flex-1 px-4">
                {/* Extra bottom padding clears the floating glass composer so the
                    last message can scroll out from behind it. */}
                <div className="max-w-[var(--chat-max-width)] mx-auto py-8 pb-40">
                  {chatMessages.map(msg => (
                    <ChatMessage
                      key={msg.id}
                      message={msg}
                      onRegenerate={msg.role === 'assistant' ? () => handleRegenerate(msg.id) : undefined}
                      onFeedback={(msgId, fb) => updateMessage(id, msgId, { feedback: fb ?? undefined })}
                    />
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>
              {/* Float the composer over the conversation so messages blur
                  through the glass as they scroll behind it. */}
              <div className="absolute inset-x-0 bottom-0">
                <Composer
                  onSend={handleSend}
                  onStop={handleStop}
                  isStreaming={isStreaming}
                  model={conversation?.model ?? defaultModel ?? 'kroex-pro'}
                  onModelClick={() => setModelSelectorOpen(true)}
                />
              </div>
            </>
          )}
        </div>

        <AnimatePresence>
          {activeArtifact && (
            <div className="w-[45%] border-l border-border flex-shrink-0">
              <ArtifactPanel
                artifact={activeArtifact}
                onClose={() => setActiveArtifact(null)}
              />
            </div>
          )}
        </AnimatePresence>
      </div>

      <ModelSelector
        open={modelSelectorOpen}
        onClose={() => setModelSelectorOpen(false)}
        selectedModel={conversation?.model ?? defaultModel ?? 'kroex-pro'}
        onSelect={modelId => updateConversation(id, { model: modelId })}
      />
    </AppShell>
  )
}

function WelcomeScreen({
  onSend,
  model,
  onModelClick,
}: {
  onSend: (content: string, files: File[]) => Promise<void>
  model: string
  onModelClick: () => void
}) {
  const PROMPTS = [
    'Explain quantum entanglement simply',
    'Write a Python web scraper',
    'Help me plan a product launch',
    'Debug this TypeScript error',
  ]

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 flex flex-col items-center justify-center px-4 pb-16">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-semibold mb-2">What can I help with?</h1>
          <p className="text-muted-foreground">Ask anything — KROEX thinks deeper, builds further.</p>
        </div>
        <div className="grid grid-cols-2 gap-2 max-w-lg w-full mb-8">
          {PROMPTS.map(p => (
            <button
              key={p}
              onClick={() => onSend(p, [])}
              className="text-left p-3 rounded-xl border border-border hover:border-primary/40 hover:bg-secondary/60 transition-all text-sm text-muted-foreground hover:text-foreground"
            >
              {p}
            </button>
          ))}
        </div>
      </div>
      <Composer onSend={onSend} model={model} onModelClick={onModelClick} />
    </div>
  )
}
