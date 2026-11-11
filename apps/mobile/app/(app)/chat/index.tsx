import { useState, useRef, useCallback, useEffect } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  KeyboardAvoidingView, Platform, StyleSheet, ActivityIndicator, Pressable, Modal,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import Animated, { FadeInDown } from 'react-native-reanimated'
import { Ionicons } from '@expo/vector-icons'
import type { ConversationOut } from '@kroex/api'
import { getClient } from '../../../lib/client'
import { chatStreamEvents } from '../../../lib/stream'
import { getApiError } from '../../../lib/errors'
import { modelLabel } from '../../../lib/models'
import { useSettingsStore } from '../../../store/settings'
import { ModelSelector } from '../../../components/ModelSelector'
import { GlassView } from '../../../components/ui/GlassView'
import { Badge } from '../../../components/ui/Badge'
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
  const defaultModel = useSettingsStore((s) => s.defaultModel)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [model, setModel] = useState<string>(defaultModel)
  const [modelPickerOpen, setModelPickerOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [artifactCount, setArtifactCount] = useState(0)
  const abortRef = useRef<AbortController | null>(null)
  const flatListRef = useRef<FlatList>(null)

  // Keep the active model in sync with the stored default until the user
  // overrides it for this conversation.
  useEffect(() => { setModel(defaultModel) }, [defaultModel])

  const updateMessage = (id: string, patch: Partial<Message>) =>
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)))
  const appendContent = (id: string, text: string) =>
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, content: m.content + text } : m)))

  const loadConversation = useCallback((conv: ConversationOut) => {
    setHistoryOpen(false)
    setConversationId(conv.id)
    setModel(conv.model || defaultModel)
    setLoadingHistory(true)
    setArtifactCount(0)
    getClient()
      .chat.listMessages(conv.id)
      .then((raw) => {
        setMessages(
          raw.map((r) => ({
            id: r.id,
            role: r.role as 'user' | 'assistant',
            content: r.content,
            status: 'done' as const,
          })),
        )
      })
      .catch(() => {})
      .finally(() => setLoadingHistory(false))
  }, [defaultModel])

  const startNewChat = () => {
    abortRef.current?.abort()
    setConversationId(null)
    setMessages([])
    setArtifactCount(0)
    setModel(defaultModel)
  }

  const handleSend = useCallback(async () => {
    const text = input.trim()
    if (!text || isStreaming) return
    setInput('')
    setIsStreaming(true)

    const userMsgId = generateId()
    const asstMsgId = generateId()
    const history = messages.map((m) => ({ role: m.role, content: m.content }))

    setMessages((prev) => [
      ...prev,
      { id: userMsgId, role: 'user', content: text, status: 'done' },
      { id: asstMsgId, role: 'assistant', content: '', status: 'streaming' },
    ])

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const { conversationId: returnedConvId, events } = await chatStreamEvents(
        {
          message: text,
          messages: [...history, { role: 'user', content: text }],
          model,
          ...(conversationId ? { conversation_id: conversationId } : {}),
        },
        controller.signal,
      )
      if (returnedConvId && !conversationId) setConversationId(returnedConvId)

      let streamError: string | null = null
      for await (const event of events) {
        if (event.type === 'delta') {
          appendContent(asstMsgId, event.text)
        } else if (event.type === 'done') {
          updateMessage(asstMsgId, { status: 'done' })
        } else if (event.type === 'artifact') {
          // Artifact events arrive after `done`, one per extracted code fence.
          setArtifactCount((n) => n + 1)
        } else if (event.type === 'error') {
          streamError = event.message
        }
      }
      if (streamError) {
        updateMessage(asstMsgId, {
          status: 'error',
          content: `⚠️ ${streamError}`,
        })
      }
    } catch (e) {
      if (!controller.signal.aborted) {
        updateMessage(asstMsgId, { status: 'error', content: `⚠️ ${getApiError(e)}` })
      }
    } finally {
      setIsStreaming(false)
      abortRef.current = null
    }
  }, [input, isStreaming, messages, conversationId, model])

  const stopStreaming = () => abortRef.current?.abort()

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable style={styles.modelBtn} onPress={() => setModelPickerOpen(true)}>
          <Text style={styles.headerTitle}>{modelLabel(model)}</Text>
          <Ionicons name="chevron-down" size={16} color={colors.mutedForeground} />
        </Pressable>
        <View style={styles.headerActions}>
          {artifactCount > 0 ? <Badge label={`${artifactCount} artifact${artifactCount > 1 ? 's' : ''}`} variant="default" /> : null}
          <Pressable hitSlop={8} onPress={() => setHistoryOpen(true)} accessibilityLabel="Conversation history">
            <Ionicons name="time-outline" size={22} color={colors.primary} />
          </Pressable>
          <Pressable hitSlop={8} onPress={startNewChat} accessibilityLabel="New chat">
            <Ionicons name="create-outline" size={22} color={colors.primary} />
          </Pressable>
        </View>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.flex}>
          {loadingHistory ? (
            <View style={styles.centeredFill}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : messages.length === 0 ? (
            <View style={styles.centeredFill}>
              <Ionicons name="sparkles-outline" size={40} color={colors.muted} />
              <Text style={styles.emptyTitle}>Think deeper. Build further.</Text>
              <Text style={styles.emptySub}>Ask KROEX anything to start a conversation.</Text>
            </View>
          ) : (
            <FlatList
              ref={flatListRef}
              data={messages}
              keyExtractor={(m) => m.id}
              contentContainerStyle={styles.messageList}
              onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
              renderItem={({ item: msg }) => (
                <Animated.View
                  entering={FadeInDown.duration(200)}
                  style={[styles.messageRow, msg.role === 'user' ? styles.userRow : styles.asstRow]}
                >
                  <View style={[styles.bubble, msg.role === 'user' ? styles.userBubble : styles.asstBubble, msg.status === 'error' && styles.errorBubble]}>
                    <Text style={[styles.messageText, msg.role === 'user' ? styles.userText : styles.asstText]}>
                      {msg.content}
                      {msg.status === 'streaming' ? '▋' : ''}
                    </Text>
                  </View>
                </Animated.View>
              )}
            />
          )}

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
                editable={!isStreaming}
              />
              {isStreaming ? (
                <TouchableOpacity style={styles.sendBtn} onPress={stopStreaming} accessibilityLabel="Stop">
                  <Ionicons name="stop" size={16} color={colors.primaryForeground} />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[styles.sendBtn, !input.trim() && styles.sendBtnDisabled]}
                  onPress={handleSend}
                  disabled={!input.trim()}
                  accessibilityLabel="Send"
                >
                  <Ionicons name="arrow-up" size={18} color={colors.primaryForeground} />
                </TouchableOpacity>
              )}
            </View>
          </GlassView>
        </View>
      </KeyboardAvoidingView>

      <ModelSelector
        visible={modelPickerOpen}
        selectedModel={model}
        onSelect={setModel}
        onClose={() => setModelPickerOpen(false)}
      />

      <ConversationHistory
        visible={historyOpen}
        onClose={() => setHistoryOpen(false)}
        onSelect={loadConversation}
        activeId={conversationId}
      />
    </SafeAreaView>
  )
}

function ConversationHistory({
  visible,
  onClose,
  onSelect,
  activeId,
}: {
  visible: boolean
  onClose: () => void
  onSelect: (c: ConversationOut) => void
  activeId: string | null
}) {
  const [items, setItems] = useState<ConversationOut[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!visible) return
    setError(null)
    setItems(null)
    getClient()
      .chat.listConversations()
      .then(setItems)
      .catch((e) => setError(getApiError(e)))
  }, [visible])

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.handle} />
          <Text style={styles.sheetTitle}>Conversations</Text>
          {error ? (
            <Text style={styles.sheetError}>{error}</Text>
          ) : items === null ? (
            <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.md }} />
          ) : items.length === 0 ? (
            <Text style={styles.sheetEmpty}>No conversations yet.</Text>
          ) : (
            <FlatList
              data={items}
              keyExtractor={(c) => c.id}
              style={{ maxHeight: 420 }}
              renderItem={({ item }) => (
                <Pressable
                  style={[styles.convRow, item.id === activeId && styles.convRowActive]}
                  onPress={() => onSelect(item)}
                >
                  <Ionicons name="chatbubble-outline" size={18} color={colors.mutedForeground} />
                  <Text style={styles.convTitle} numberOfLines={1}>
                    {item.title || 'Untitled'}
                  </Text>
                </Pressable>
              )}
            />
          )}
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  centeredFill: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: spacing.md },
  emptyTitle: { ...typography.labelLg, color: colors.onSurface, marginTop: 4 },
  emptySub: { ...typography.bodySm, color: colors.mutedForeground, textAlign: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  modelBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  headerTitle: { ...typography.labelLg, color: colors.onSurface, fontWeight: '600' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  messageList: { paddingHorizontal: spacing.sm, paddingVertical: 12, paddingBottom: 96, gap: 12 },
  messageRow: { flexDirection: 'row' },
  userRow: { justifyContent: 'flex-end' },
  asstRow: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '82%', borderRadius: radii.lg, padding: 12 },
  userBubble: { backgroundColor: colors.primary },
  asstBubble: { backgroundColor: colors.secondarySurface },
  errorBubble: { backgroundColor: 'rgba(217,45,32,0.08)' },
  messageText: { ...typography.bodyMd, fontSize: 15, lineHeight: 22 },
  userText: { color: colors.primaryForeground },
  asstText: { color: colors.onSurface },
  composer: { position: 'absolute', left: spacing.sm, right: spacing.sm, bottom: spacing.sm },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 10, paddingVertical: 8, gap: 8 },
  input: { flex: 1, minHeight: 40, maxHeight: 160, paddingHorizontal: 10, paddingVertical: 10, ...typography.bodyMd, fontSize: 15, color: colors.onSurface },
  sendBtn: { width: 40, height: 40, borderRadius: radii.full, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  sendBtnDisabled: { backgroundColor: colors.muted },
  // sheet (history)
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: radii.xl, borderTopRightRadius: radii.xl, padding: spacing.sm, paddingBottom: spacing.md },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.muted, marginBottom: 8 },
  sheetTitle: { ...typography.labelLg, color: colors.onSurface, marginBottom: 8 },
  sheetError: { ...typography.bodySm, color: colors.error, paddingVertical: spacing.sm },
  sheetEmpty: { ...typography.bodySm, color: colors.mutedForeground, paddingVertical: spacing.sm },
  convRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 6, borderRadius: radii.md },
  convRowActive: { backgroundColor: 'rgba(0,113,227,0.06)' },
  convTitle: { ...typography.bodyMd, fontSize: 15, color: colors.onSurface, flex: 1 },
})
