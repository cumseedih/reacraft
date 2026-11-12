import { useState, useRef, useCallback, type ComponentRef } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  KeyboardAvoidingView, Platform, StyleSheet,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import type { BotActionOut } from '@kroex/api'
import { botStreamEvents } from '../../../lib/stream'
import { getClient } from '../../../lib/client'
import { getApiError, isUnavailable, FEATURE_UNAVAILABLE_MESSAGE } from '../../../lib/errors'
import { confirmDestructive } from '../../../lib/confirm'
import { isDestructiveAction, describeActionStatus } from '../../../lib/status'
import { useSettingsStore } from '../../../store/settings'
import { ScreenHeader } from '../../../components/ui/ScreenHeader'
import { Card } from '../../../components/ui/Card'
import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { colors, radii, spacing, typography } from '../../../theme/tokens'

interface TextTurn { kind: 'text'; id: string; role: 'user' | 'assistant'; content: string }
interface ActionTurn { kind: 'action'; id: string; action: ActionState }
type Turn = TextTurn | ActionTurn

interface ActionState {
  id: string
  action: string
  status: string
  error: string | null
  busy?: boolean
}

function genId() { return Math.random().toString(36).slice(2) + Date.now().toString(36) }

export default function BotScreen() {
  const defaultModel = useSettingsStore((s) => s.defaultModel)
  const [turns, setTurns] = useState<Turn[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [fatalError, setFatalError] = useState<string | null>(null)
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null)
  const abortRef = useRef<AbortController | null>(null)

  const appendAsst = (id: string, text: string) =>
    setTurns((prev) => prev.map((t) => (t.kind === 'text' && t.id === id ? { ...t, content: t.content + text } : t)))

  const upsertAction = (a: ActionState) =>
    setTurns((prev) => {
      const idx = prev.findIndex((t) => t.kind === 'action' && t.action.id === a.id)
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = { kind: 'action', id: a.id, action: { ...(next[idx] as ActionTurn).action, ...a } }
        return next
      }
      return [...prev, { kind: 'action', id: a.id, action: a }]
    })

  const setActionBusy = (id: string, busy: boolean) =>
    setTurns((prev) => prev.map((t) => (t.kind === 'action' && t.action.id === id ? { kind: 'action', id, action: { ...t.action, busy } } : t)))

  const handleSend = useCallback(async () => {
    const text = input.trim()
    if (!text || streaming) return
    setInput('')
    setStreaming(true)
    setFatalError(null)
    const asstId = genId()
    setTurns((prev) => [
      ...prev,
      { kind: 'text', id: genId(), role: 'user', content: text },
      { kind: 'text', id: asstId, role: 'assistant', content: '' },
    ])
    const controller = new AbortController()
    abortRef.current = controller
    try {
      const { events } = await botStreamEvents({ message: text, model: defaultModel }, controller.signal)
      for await (const event of events) {
        if (event.type === 'delta') appendAsst(asstId, event.text)
        else if (event.type === 'action') {
          upsertAction({ id: event.action.id, action: event.action.action, status: event.action.status, error: event.action.error })
        } else if (event.type === 'action_result') {
          setTurns((prev) => prev.map((t) =>
            t.kind === 'action' && t.action.id === event.action_id
              ? { kind: 'action', id: t.id, action: { ...t.action, status: 'executed', busy: false } }
              : t))
        } else if (event.type === 'error') {
          appendAsst(asstId, `\n⚠️ ${event.message}`)
        }
      }
    } catch (e) {
      if (!controller.signal.aborted) {
        if (isUnavailable(e)) setFatalError(FEATURE_UNAVAILABLE_MESSAGE)
        else appendAsst(asstId, `\n⚠️ ${getApiError(e)}`)
      }
    } finally {
      setStreaming(false)
      abortRef.current = null
    }
  }, [input, streaming, defaultModel])

  const applyActionResult = (res: BotActionOut) =>
    upsertAction({ id: res.id, action: res.action, status: res.status, error: res.error ?? null, busy: false })

  const onConfirm = async (a: ActionState) => {
    // Destructive/sensitive actions pass through a native confirmation gate
    // first — never auto-confirmed, no trusted bypass.
    if (isDestructiveAction(a.action)) {
      const ok = await confirmDestructive({
        title: 'Confirm action',
        message: `This will run "${a.action}", which can change or delete data. Continue?`,
        confirmLabel: 'Run action',
      })
      if (!ok) return
    }
    setActionBusy(a.id, true)
    try {
      applyActionResult(await getClient().bot.confirmAction(a.id))
    } catch (e) {
      upsertAction({ ...a, error: getApiError(e), busy: false })
    }
  }

  const onReject = async (a: ActionState) => {
    setActionBusy(a.id, true)
    try {
      applyActionResult(await getClient().bot.rejectAction(a.id))
    } catch (e) {
      upsertAction({ ...a, error: getApiError(e), busy: false })
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader title="KROEX BOT" onBack={() => router.back()} />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.transcript}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
        >
          {turns.length === 0 ? (
            <View style={styles.intro}>
              <Ionicons name="hardware-chip-outline" size={36} color={colors.muted} />
              <Text style={styles.introTitle}>KROEX BOT</Text>
              <Text style={styles.introSub}>
                Ask the BOT to do things. It proposes each action — destructive ones require your confirmation.
              </Text>
            </View>
          ) : null}
          {fatalError ? <Text style={styles.fatal}>{fatalError}</Text> : null}
          {turns.map((t) =>
            t.kind === 'text' ? (
              t.content.length > 0 ? (
                <View key={t.id} style={[styles.bubbleRow, t.role === 'user' ? styles.right : styles.left]}>
                  <View style={[styles.bubble, t.role === 'user' ? styles.userBubble : styles.asstBubble]}>
                    <Text style={[styles.bubbleText, t.role === 'user' ? styles.userText : styles.asstText]}>{t.content}</Text>
                  </View>
                </View>
              ) : null
            ) : (
              <ActionCard key={t.id} action={t.action} onConfirm={onConfirm} onReject={onReject} />
            ),
          )}
        </ScrollView>

        <View style={styles.composer}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="Ask the BOT…"
            placeholderTextColor={colors.mutedForeground}
            multiline
            editable={!streaming}
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!input.trim() || streaming) && styles.sendBtnDisabled]}
            onPress={handleSend}
            disabled={!input.trim() || streaming}
          >
            <Ionicons name="arrow-up" size={18} color={colors.primaryForeground} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

function ActionCard({
  action,
  onConfirm,
  onReject,
}: {
  action: ActionState
  onConfirm: (a: ActionState) => void
  onReject: (a: ActionState) => void
}) {
  const status = describeActionStatus(action.status)
  const destructive = isDestructiveAction(action.action)
  return (
    <Card style={styles.actionCard}>
      <View style={styles.actionTop}>
        <View style={styles.actionTitleWrap}>
          <Ionicons name={destructive ? 'warning-outline' : 'flash-outline'} size={16} color={destructive ? colors.error : colors.primary} />
          <Text style={styles.actionName}>{action.action}</Text>
        </View>
        <Badge label={status.label} variant={status.variant} />
      </View>
      {destructive ? <Text style={styles.destructiveNote}>Requires confirmation — may change or delete data.</Text> : null}
      {action.error ? <Text style={styles.actionError}>{action.error}</Text> : null}
      {status.awaitingDecision ? (
        <View style={styles.actionBtns}>
          <Button title="Reject" variant="secondary" onPress={() => onReject(action)} disabled={action.busy} style={{ flex: 1 }} />
          <Button title={destructive ? 'Confirm…' : 'Confirm'} onPress={() => onConfirm(action)} loading={action.busy} style={{ flex: 1 }} />
        </View>
      ) : null}
    </Card>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  transcript: { padding: spacing.sm, gap: 10, paddingBottom: 12 },
  intro: { alignItems: 'center', gap: 6, paddingVertical: spacing.lg },
  introTitle: { ...typography.labelLg, color: colors.onSurface },
  introSub: { ...typography.bodySm, color: colors.mutedForeground, textAlign: 'center', maxWidth: 300 },
  fatal: { ...typography.bodySm, color: colors.error, textAlign: 'center', padding: spacing.sm },
  bubbleRow: { flexDirection: 'row' },
  left: { justifyContent: 'flex-start' },
  right: { justifyContent: 'flex-end' },
  bubble: { maxWidth: '85%', borderRadius: radii.lg, padding: 12 },
  userBubble: { backgroundColor: colors.primary },
  asstBubble: { backgroundColor: colors.secondarySurface },
  bubbleText: { ...typography.bodyMd, fontSize: 15, lineHeight: 22 },
  userText: { color: colors.primaryForeground },
  asstText: { color: colors.onSurface },
  actionCard: { gap: 8, borderColor: 'rgba(0,113,227,0.25)' },
  actionTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  actionTitleWrap: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  actionName: { ...typography.labelMd, color: colors.onSurface },
  destructiveNote: { ...typography.labelSm, color: colors.error },
  actionError: { ...typography.bodySm, color: colors.error },
  actionBtns: { flexDirection: 'row', gap: 8, marginTop: 4 },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, padding: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  input: { flex: 1, minHeight: 44, maxHeight: 140, backgroundColor: colors.secondarySurface, borderRadius: radii.lg, paddingHorizontal: 14, paddingVertical: 10, ...typography.bodyMd, fontSize: 15, color: colors.onSurface },
  sendBtn: { width: 44, height: 44, borderRadius: radii.full, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  sendBtnDisabled: { backgroundColor: colors.muted },
})
