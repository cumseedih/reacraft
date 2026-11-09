import { useState, useRef, useCallback, useEffect } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  KeyboardAvoidingView, Platform, StyleSheet, ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import Animated, { FadeInDown } from 'react-native-reanimated'
import { Ionicons } from '@expo/vector-icons'
import { api } from '../../../lib/api'

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
      const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000'
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

        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="Message KROEX…"
            placeholderTextColor="#9CA3AF"
            multiline
            maxLength={8000}
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!input.trim() || isStreaming) && styles.sendBtnDisabled]}
            onPress={handleSend}
            disabled={!input.trim() || isStreaming}
          >
            <Ionicons name="arrow-up" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAF8' },
  flex: { flex: 1 },
  header: { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#E8E6DC' },
  headerTitle: { fontSize: 18, fontWeight: '600', color: '#141413' },
  messageList: { paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
  messageRow: { flexDirection: 'row' },
  userRow: { justifyContent: 'flex-end' },
  asstRow: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '82%', borderRadius: 18, padding: 12 },
  userBubble: { backgroundColor: '#2563EB' },
  asstBubble: { backgroundColor: '#F3F2ED' },
  messageText: { fontSize: 15, lineHeight: 22 },
  userText: { color: '#fff' },
  asstText: { color: '#141413' },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#E8E6DC',
    gap: 8,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 160,
    backgroundColor: '#F3F2ED',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: '#141413',
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { backgroundColor: '#D1D5DB' },
})
