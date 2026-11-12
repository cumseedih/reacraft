import { useState, useRef, useEffect, useCallback, type ComponentRef } from 'react'
import { View, Text, ScrollView, StyleSheet, TextInput, Pressable, Platform } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  isRestoreInProgress,
  isRestoreComplete,
  type SnapshotOut,
} from '@kroex/api'
import { getClient } from '../../../../lib/client'
import { streamCommandEvents } from '../../../../lib/stream'
import { getApiError } from '../../../../lib/errors'
import { confirmDestructive } from '../../../../lib/confirm'
import { describeSessionState, describeRestoreState } from '../../../../lib/status'
import { ScreenHeader } from '../../../../components/ui/ScreenHeader'
import { Card } from '../../../../components/ui/Card'
import { Button } from '../../../../components/ui/Button'
import { Input } from '../../../../components/ui/Input'
import { Badge } from '../../../../components/ui/Badge'
import { LoadingView } from '../../../../components/ui/States'
import { colors, radii, spacing, typography } from '../../../../theme/tokens'

const mono = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' })

interface OutputLine { stream: string; text: string }

export default function SandboxSessionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const sessionId = String(id)
  const qc = useQueryClient()

  const sessionQ = useQuery({
    queryKey: ['sandbox-session', sessionId],
    queryFn: () => getClient().sandbox.getSession(sessionId),
    retry: 1,
    refetchInterval: (q) => {
      const st = q.state.data?.state
      return st && ['provisioning'].includes(st) ? 2000 : false
    },
  })
  const session = sessionQ.data
  const workspaceId = session?.workspace_id

  // ---- Command execution (named SSE; interactive PTY is web/desktop only) ----
  const [command, setCommand] = useState('')
  const [output, setOutput] = useState<OutputLine[]>([])
  const [running, setRunning] = useState(false)
  const [exitInfo, setExitInfo] = useState<string | null>(null)
  const [activeCommandId, setActiveCommandId] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const outRef = useRef<ComponentRef<typeof ScrollView>>(null)

  useEffect(() => () => abortRef.current?.abort(), [])

  const runCommand = async () => {
    const cmd = command.trim()
    if (!cmd || running) return
    setOutput((p) => [...p, { stream: 'input', text: `$ ${cmd}` }])
    setCommand('')
    setExitInfo(null)
    setRunning(true)
    try {
      const created = await getClient().sandbox.createCommand(sessionId, { command: cmd })
      setActiveCommandId(created.id)
      const controller = new AbortController()
      abortRef.current = controller
      await streamCommandEvents(
        created.id,
        (event) => {
          if (event.event === 'output') {
            setOutput((p) => [...p, { stream: event.stream, text: event.data }])
          } else if (event.event === 'exit') {
            setExitInfo(`${event.status}${event.exit_code != null ? ` (exit ${event.exit_code})` : ''}${event.output_truncated ? ' · output truncated' : ''}`)
          } else if (event.event === 'error') {
            setOutput((p) => [...p, { stream: 'stderr', text: `⚠️ ${event.detail}` }])
          }
        },
        controller.signal,
      )
    } catch (e) {
      setOutput((p) => [...p, { stream: 'stderr', text: `⚠️ ${getApiError(e)}` }])
    } finally {
      setRunning(false)
      setActiveCommandId(null)
      abortRef.current = null
    }
  }

  const cancelCommand = async () => {
    if (activeCommandId) {
      try { await getClient().sandbox.cancelCommand(activeCommandId) } catch { /* ignore */ }
    }
    abortRef.current?.abort()
  }

  // ---- Snapshots (restore honesty) ----
  const [restoreInProgress, setRestoreInProgress] = useState(false)

  const snapshotsQ = useQuery({
    queryKey: ['sandbox-snapshots', workspaceId],
    queryFn: () => getClient().sandbox.listSnapshots(workspaceId as string),
    enabled: !!workspaceId,
    retry: 1,
  })

  const createSnapshot = async () => {
    if (!workspaceId) return
    try {
      await getClient().sandbox.createSnapshot(workspaceId, {})
      snapshotsQ.refetch()
    } catch (e) {
      await confirmDestructive({ title: 'Snapshot failed', message: getApiError(e), confirmLabel: 'OK', destructive: false })
    }
  }

  /** Polls a snapshot's restore_state until terminal; never claims success early. */
  const pollRestore = useCallback(async (snapshotId: string) => {
    for (let i = 0; i < 150; i++) {
      await new Promise((r) => setTimeout(r, 2000))
      try {
        const snap = await getClient().sandbox.getSnapshot(snapshotId)
        snapshotsQ.refetch()
        if (isRestoreComplete(snap.restore_state)) {
          setRestoreInProgress(false)
          qc.invalidateQueries({ queryKey: ['sandbox-session', sessionId] })
          return
        }
        if (!isRestoreInProgress(snap.restore_state)) {
          // failed or idle → stop; do NOT claim completion
          setRestoreInProgress(false)
          return
        }
      } catch {
        setRestoreInProgress(false)
        return
      }
    }
    setRestoreInProgress(false)
  }, [qc, sessionId, snapshotsQ])

  const restoreSnapshot = async (snap: SnapshotOut) => {
    const ok = await confirmDestructive({
      title: 'Restore snapshot',
      message: 'Restore the workspace to this snapshot? Current workspace contents will be replaced.',
      confirmLabel: 'Restore',
    })
    if (!ok) return
    try {
      const res = await getClient().sandbox.restoreSnapshot(snap.id)
      snapshotsQ.refetch()
      // Block resume while the restore is queued/running. Only a `completed`
      // restore_state is treated as success — we never assume it finished.
      if (isRestoreInProgress(res.restore_state)) {
        setRestoreInProgress(true)
        pollRestore(snap.id)
      } else if (isRestoreComplete(res.restore_state)) {
        qc.invalidateQueries({ queryKey: ['sandbox-session', sessionId] })
      }
    } catch (e) {
      await confirmDestructive({ title: 'Restore failed', message: getApiError(e), confirmLabel: 'OK', destructive: false })
    }
  }

  // ---- Session lifecycle ----
  const stopSession = async () => {
    try { await getClient().sandbox.stopSession(sessionId); sessionQ.refetch() } catch { /* ignore */ }
  }
  const resumeSession = async () => {
    if (restoreInProgress) return // blocked while a restore is in progress
    try { await getClient().sandbox.resumeSession(sessionId); sessionQ.refetch() } catch { /* ignore */ }
  }
  const destroySession = async () => {
    const ok = await confirmDestructive({
      title: 'Destroy session',
      message: 'Destroy this session? This is permanent.',
      confirmLabel: 'Destroy',
    })
    if (!ok) return
    try {
      await getClient().sandbox.destroySession(sessionId)
      qc.invalidateQueries({ queryKey: ['sandbox-sessions'] })
      router.back()
    } catch { /* ignore */ }
  }

  if (sessionQ.isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <ScreenHeader title="Session" onBack={() => router.back()} />
        <LoadingView />
      </SafeAreaView>
    )
  }

  const state = session ? describeSessionState(session.state) : null
  const canRunCommands = session ? state?.live : false

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader
        title={session?.image ?? 'Session'}
        onBack={() => router.back()}
        actions={[{ icon: 'trash-outline', onPress: destroySession, accessibilityLabel: 'Destroy session' }]}
      />
      <ScrollView contentContainerStyle={styles.body}>
        {/* State + lifecycle */}
        <Card style={{ gap: 10 }}>
          <View style={styles.stateRow}>
            {state ? <Badge label={state.label} variant={state.variant} /> : null}
            <Text style={styles.meta}>{session?.network_policy} · {session?.runtime}</Text>
          </View>
          {session?.error ? <Text style={styles.err}>{session.error}</Text> : null}
          {restoreInProgress ? (
            <Text style={styles.restoreNote}>A snapshot restore is in progress — resume is blocked until it completes.</Text>
          ) : null}
          <View style={styles.lifecycle}>
            <Button title="Stop" variant="secondary" onPress={stopSession} style={{ flex: 1 }} />
            <Button title="Resume" onPress={resumeSession} disabled={restoreInProgress} style={{ flex: 1 }} />
          </View>
        </Card>

        {/* Command execution */}
        <Card style={{ gap: 8 }}>
          <Text style={styles.sectionLabel}>Run a command</Text>
          <Text style={styles.ptyNote}>
            Command output streams below. An interactive PTY terminal is available on web and desktop.
          </Text>
          <View style={styles.cmdRow}>
            <TextInput
              style={styles.cmdInput}
              value={command}
              onChangeText={setCommand}
              placeholder="e.g. python --version"
              placeholderTextColor={colors.mutedForeground}
              autoCapitalize="none"
              autoCorrect={false}
              editable={!running && !!canRunCommands}
              onSubmitEditing={runCommand}
            />
            {running ? (
              <Pressable style={styles.cmdBtn} onPress={cancelCommand}><Ionicons name="stop" size={16} color={colors.primaryForeground} /></Pressable>
            ) : (
              <Pressable style={[styles.cmdBtn, (!command.trim() || !canRunCommands) && styles.cmdBtnDisabled]} onPress={runCommand} disabled={!command.trim() || !canRunCommands}>
                <Ionicons name="play" size={16} color={colors.primaryForeground} />
              </Pressable>
            )}
          </View>
          {!canRunCommands ? <Text style={styles.meta}>Session must be running to execute commands.</Text> : null}
          {output.length > 0 ? (
            <ScrollView
              ref={outRef}
              style={styles.terminal}
              onContentSizeChange={() => outRef.current?.scrollToEnd({ animated: true })}
            >
              {output.map((l, i) => (
                <Text key={i} style={[styles.termLine, l.stream === 'stderr' && styles.termErr, l.stream === 'input' && styles.termInput]}>
                  {l.text}
                </Text>
              ))}
              {exitInfo ? <Text style={styles.termExit}>— {exitInfo}</Text> : null}
            </ScrollView>
          ) : null}
        </Card>

        {/* Snapshots */}
        <Card style={{ gap: 8 }}>
          <View style={styles.snapHeader}>
            <Text style={styles.sectionLabel}>Snapshots</Text>
            <Button title="Create" variant="secondary" onPress={createSnapshot} />
          </View>
          {snapshotsQ.data && snapshotsQ.data.length > 0 ? (
            snapshotsQ.data.map((snap) => <SnapshotRow key={snap.id} snap={snap} onRestore={() => restoreSnapshot(snap)} blocked={restoreInProgress} />)
          ) : (
            <Text style={styles.meta}>No snapshots yet.</Text>
          )}
        </Card>
      </ScrollView>
    </SafeAreaView>
  )
}

function SnapshotRow({ snap, onRestore, blocked }: { snap: SnapshotOut; onRestore: () => void; blocked: boolean }) {
  const restore = describeRestoreState(snap.restore_state)
  return (
    <View style={styles.snapRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.snapId} numberOfLines={1}>{snap.sha256.slice(0, 12)}…</Text>
        <View style={styles.snapMetaRow}>
          <Text style={styles.meta}>{(snap.size_bytes / 1024).toFixed(0)} KB</Text>
          {snap.restore_state && snap.restore_state !== 'idle' ? <Badge label={restore.label} variant={restore.variant} /> : null}
        </View>
        {snap.restore_error ? <Text style={styles.err}>{snap.restore_error}</Text> : null}
      </View>
      <Button
        title={restore.inProgress ? 'Restoring…' : 'Restore'}
        variant="secondary"
        onPress={onRestore}
        disabled={blocked || restore.inProgress}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  body: { padding: spacing.sm, gap: 12 },
  stateRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  meta: { ...typography.labelSm, color: colors.mutedForeground },
  err: { ...typography.bodySm, color: colors.error },
  restoreNote: { ...typography.labelSm, color: '#B45309' },
  lifecycle: { flexDirection: 'row', gap: 8 },
  sectionLabel: { ...typography.labelMd, color: colors.onSurface },
  ptyNote: { ...typography.labelSm, color: colors.mutedForeground },
  cmdRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  cmdInput: { flex: 1, minHeight: 44, backgroundColor: colors.secondarySurface, borderRadius: radii.md, paddingHorizontal: 12, fontFamily: mono, fontSize: 13, color: colors.onSurface },
  cmdBtn: { width: 44, height: 44, borderRadius: radii.md, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  cmdBtnDisabled: { backgroundColor: colors.muted },
  terminal: { maxHeight: 260, backgroundColor: colors.neutral, borderRadius: radii.md, padding: 10 },
  termLine: { fontFamily: mono, fontSize: 12, color: '#E5E7EB', lineHeight: 17 },
  termErr: { color: '#FCA5A5' },
  termInput: { color: '#93C5FD' },
  termExit: { fontFamily: mono, fontSize: 12, color: '#9CA3AF', marginTop: 4 },
  snapHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  snapRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  snapId: { ...typography.labelMd, color: colors.onSurface, fontFamily: mono },
  snapMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
})
