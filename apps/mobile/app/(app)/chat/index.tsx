import { useState, useRef, useCallback, useEffect } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  KeyboardAvoidingView, Platform, StyleSheet, ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import Animated, { FadeInDown } from 'react-native-reanimated'
import { Ionicons } from '@expo/vector-icons'
import { api } from '../../../lib/api'
import { requireApiBaseUrl } from '../../../lib/config'
import { GlassView } from '../../../components/ui/GlassView'
import { colors, radii, spacing, typography } from '../../../theme/tokens'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  status: 'done' | 'streaming' | 'error'
}

function generateId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

export default function ChatScreen() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [loadingHistory, setLoadingHistory] = useState(false)
  const flatListRef = useRef<FlatList>(null)

  const updateMessage = (id: string, patch: Partial<Message>) =>
    setMessages(prev => prev.map(m => m.id === id ? { ...m, ...patch } : m))
  const appendContent = (id: string, text: string) =>
    setMessages(prev => prev.map(m => m.id === id ? { ...m, content: m.content + text } : m))

  // Load history when resuming an existing conversation.
  useEffect(() => {
    if (!conversationId) return
    setLoadingHistory(true)
    api.get<any[]>(`/api/conversations/${conversationId}/messages`)
      .then(raw => {
        const loaded: Message[] = raw.map(r => ({
          id: r.id,
          role: r.role,
          content: r.content,
          status: 'done' as const,
        }))
        setMessages(loaded)
      })
      .catch(() => {})
      .finally(() => setLoadingHistory(false))
  }, [conversationId])

  const handleSend = useCallback(async () => {
    const text = input.trim()
    if (!text || isStreaming) return
    setInput('')
    setIsStreaming(true)

    const userMsgId = generateId()
    const asstMsgId = generateId()

    setMessages(prev => [
      ...prev,
      { id: userMsgId, role: 'user', content: text, status: 'done' },
      { id: asstMsgId, role: 'assistant', content: '', status: 'streaming' },
    ])

    try {
      // Build history from current messages (before the new pair was appended).
      const history = messages.map(m => ({ role: m.role, content: m.content }))

      const payload: Record<string, unknown> = {
        message: text,
        messages: [...history, { role: 'user', content: text }],
        model: 'kroex-pro',
      }
      if (conversationId) payload.conversation_id = conversationId

      // Use fetch directly to capture X-Conversation-Id from response headers.
      const BASE_URL = requireApiBaseUrl()
      const { getItemAsync } = await import('expo-secure-store')
      const token = await getItemAsync('kroex_token')

      const res = await fetch(`${BASE_URL}/api/chat/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      })

      if (!res.ok || !res.body) throw new Error('Stream failed')

      // Capture conversation ID from first response so follow-up turns continue it.
      const returnedConvId = res.headers.get('x-conversation-id')
      if (returnedConvId && !conversationId) {
        setConversationId(returnedConvId)
      }

      // Read SSE body.
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))
              if (data.type === 'delta' && data.text) {
                appendContent(asstMsgId, data.text)
              } else if (data.type === 'done') {
                updateMessage(asstMsgId, { status: 'done' })
              }
            } catch {
              // ignore parse errors
            }
          }
        }
      }
    } catch {
      updateMessage(asstMsgId, { status: 'error' })
    } finally {
      setIsStreaming(false)
    }
  }, [input, isStreaming, messages, conversationId])

  if (loadingHistory) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>KROEX</Text>
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color="#2563EB" />
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>KROEX</Text>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <View style={styles.flex}>
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={m => m.id}
            contentContainerStyle={styles.messageList}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
            renderItem={({ item: msg }) => (
              <Animated.View
                entering={FadeInDown.duration(200)}
                style={[styles.messageRow, msg.role === 'user' ? styles.userRow : styles.asstRow]}
              >
                <View style={[styles.bubble, msg.role === 'user' ? styles.userBubble : styles.asstBubble]}>
                  <Text style={[styles.messageText, msg.role === 'user' ? styles.userText : styles.asstText]}>
                    {msg.content}
                    {msg.status === 'streaming' ? '▋' : ''}
                  </Text>
                </View>
              </Animated.View>
            )}
          />

          {/* Floating Liquid Glass composer: messages blur behind it as they
              scroll underneath (real native blur via expo-blur). */}
          <GlassView style={styles.composer} radius={radii.xl} intensity={50}>
            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                value={input}
                onChangeText={setInput}
                placeholder="Message KROEX…"
                placeholderTextColor={colors.mutedForeground}
                multiline
                maxLength={8000}
              />
              <TouchableOpacity
                style={[styles.sendBtn, (!input.trim() || isStreaming) && styles.sendBtnDisabled]}
                onPress={handleSend}
                disabled={!input.trim() || isStreaming}
              >
                <Ionicons name="arrow-up" size={18} color={colors.primaryForeground} />
              </TouchableOpacity>
            </View>
          </GlassView>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  header: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  headerTitle: { ...typography.labelLg, color: colors.onSurface, fontWeight: '600' },
  // Bottom padding clears the floating glass composer so the last message can
  // scroll out from behind it.
  messageList: { paddingHorizontal: spacing.sm, paddingVertical: 12, paddingBottom: 96, gap: 12 },
  messageRow: { flexDirection: 'row' },
  userRow: { justifyContent: 'flex-end' },
  asstRow: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '82%', borderRadius: radii.lg, padding: 12 },
  userBubble: { backgroundColor: colors.primary },
  asstBubble: { backgroundColor: colors.secondarySurface },
  messageText: { ...typography.bodyMd, fontSize: 15, lineHeight: 22 },
  userText: { color: colors.primaryForeground },
  asstText: { color: colors.onSurface },
  composer: {
    position: 'absolute',
    left: spacing.sm,
    right: spacing.sm,
    bottom: spacing.sm,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 8,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 160,
    paddingHorizontal: 10,
    paddingVertical: 10,
    ...typography.bodyMd,
    fontSize: 15,
    color: colors.onSurface,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: radii.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { backgroundColor: colors.muted },
})
