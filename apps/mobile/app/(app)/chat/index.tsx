import { useState, useRef, useCallback } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  KeyboardAvoidingView, Platform, StyleSheet,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import Animated, { FadeInDown } from 'react-native-reanimated'
import { Ionicons } from '@expo/vector-icons'
import { useAuthStore } from '../../../store/auth'
import { streamSSE } from '../../../lib/api'
import { generateId } from '../../../lib/utils'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  status: 'done' | 'streaming' | 'error'
}

export default function ChatScreen() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const flatListRef = useRef<FlatList>(null)

  const addMessage = (msg: Message) => setMessages(prev => [...prev, msg])
  const updateMessage = (id: string, patch: Partial<Message>) =>
    setMessages(prev => prev.map(m => m.id === id ? { ...m, ...patch } : m))
  const appendContent = (id: string, text: string) =>
    setMessages(prev => prev.map(m => m.id === id ? { ...m, content: m.content + text } : m))

  const handleSend = useCallback(async () => {
    const text = input.trim()
    if (!text || isStreaming) return
    setInput('')
    setIsStreaming(true)

    const userMsgId = generateId()
    const asstMsgId = generateId()

    addMessage({ id: userMsgId, role: 'user', content: text, status: 'done' })
    addMessage({ id: asstMsgId, role: 'assistant', content: '', status: 'streaming' })

    try {
      for await (const line of streamSSE('/api/chat/stream', {
        messages: [{ role: 'user', content: text }],
        model: 'kroex-pro',
      })) {
        const data = JSON.parse(line)
        if (data.type === 'delta') appendContent(asstMsgId, data.text)
        else if (data.type === 'done') updateMessage(asstMsgId, { status: 'done' })
      }
    } catch {
      updateMessage(asstMsgId, { status: 'error' })
    } finally {
      setIsStreaming(false)
    }
  }, [input, isStreaming])

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
