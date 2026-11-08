import { create } from 'zustand'
import type { Conversation, Message, Artifact } from '@/types'

interface ChatState {
  conversations: Conversation[]
  activeConversationId: string | null
  messages: Record<string, Message[]>
  artifacts: Record<string, Artifact>
  activeArtifactId: string | null
  isStreaming: boolean
  streamingMessageId: string | null

  setConversations: (convs: Conversation[]) => void
  addConversation: (conv: Conversation) => void
  updateConversation: (id: string, patch: Partial<Conversation>) => void
  removeConversation: (id: string) => void
  setActiveConversation: (id: string | null) => void

  setMessages: (convId: string, msgs: Message[]) => void
  addMessage: (convId: string, msg: Message) => void
  updateMessage: (convId: string, msgId: string, patch: Partial<Message>) => void
  appendMessageContent: (convId: string, msgId: string, delta: string) => void

  setArtifact: (artifact: Artifact) => void
  addArtifact: (artifact: Artifact) => void
  updateArtifact: (id: string, patch: Partial<Artifact>) => void
  setActiveArtifact: (id: string | null) => void

  setStreaming: (streaming: boolean, msgId?: string) => void
}

export const useChatStore = create<ChatState>((set) => ({
  conversations: [],
  activeConversationId: null,
  messages: {},
  artifacts: {},
  activeArtifactId: null,
  isStreaming: false,
  streamingMessageId: null,

  setConversations: (conversations) => set({ conversations }),
  addConversation: (conv) => set((s) => ({ conversations: [conv, ...s.conversations] })),
  updateConversation: (id, patch) => set((s) => ({
    conversations: s.conversations.map(c => c.id === id ? { ...c, ...patch } : c)
  })),
  removeConversation: (id) => set((s) => ({
    conversations: s.conversations.filter(c => c.id !== id),
    activeConversationId: s.activeConversationId === id ? null : s.activeConversationId,
  })),
  setActiveConversation: (activeConversationId) => set({ activeConversationId }),

  setMessages: (convId, msgs) => set((s) => ({ messages: { ...s.messages, [convId]: msgs } })),
  addMessage: (convId, msg) => set((s) => ({
    messages: { ...s.messages, [convId]: [...(s.messages[convId] ?? []), msg] }
  })),
  updateMessage: (convId, msgId, patch) => set((s) => ({
    messages: {
      ...s.messages,
      [convId]: (s.messages[convId] ?? []).map(m => m.id === msgId ? { ...m, ...patch } : m)
    }
  })),
  appendMessageContent: (convId, msgId, delta) => set((s) => ({
    messages: {
      ...s.messages,
      [convId]: (s.messages[convId] ?? []).map(m =>
        m.id === msgId ? { ...m, content: (m.content as string) + delta } : m
      )
    }
  })),

  setArtifact: (artifact) => set((s) => ({ artifacts: { ...s.artifacts, [artifact.id]: artifact } })),
  addArtifact: (artifact) => set((s) => ({ artifacts: { ...s.artifacts, [artifact.id]: artifact } })),
  updateArtifact: (id, patch) => set((s) => ({
    artifacts: { ...s.artifacts, [id]: { ...(s.artifacts[id] ?? {}), ...patch } as Artifact }
  })),
  setActiveArtifact: (activeArtifactId) => set({ activeArtifactId }),

  setStreaming: (isStreaming, msgId) => set({ isStreaming, streamingMessageId: msgId ?? null }),
}))
