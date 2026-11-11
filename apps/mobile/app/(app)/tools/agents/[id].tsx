import { useState, useRef, useCallback, useEffect } from 'react'
import { View, Text, ScrollView, StyleSheet, Pressable, TextInput, Modal, Platform } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { AgentRunOut, PatchOut } from '@kroex/api'
import { getClient } from '../../../../lib/client'
import { agentRunEvents } from '../../../../lib/stream'
import { getApiError } from '../../../../lib/errors'
import { confirmDestructive } from '../../../../lib/confirm'
import { describeRunStatus } from '../../../../lib/status'
import { ScreenHeader } from '../../../../components/ui/ScreenHeader'
import { Card } from '../../../../components/ui/Card'
import { Button } from '../../../../components/ui/Button'
import { Badge } from '../../../../components/ui/Badge'
import { LoadingView } from '../../../../components/ui/States'
import { colors, radii, spacing, typography } from '../../../../theme/tokens'

interface LiveRun {
  runId: string
  status: string
  log: string
  steps: string[]
  error: string | null
}

export default function AgentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const agentId = String(id)
  const qc = useQueryClient()
  const [prompt, setPrompt] = useState('')
  const [launching, setLaunching] = useState(false)
  const [live, setLive] = useState<LiveRun | null>(null)
  const [patch, setPatch] = useState<PatchOut | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const agentQ = useQuery({ queryKey: ['agent', agentId], queryFn: () => getClient().agents.get(agentId), retry: 1 })
  const runsQ = useQuery({ queryKey: ['agent-runs', agentId], queryFn: () => getClient().agents.listRuns(agentId), retry: 1 })

  useEffect(() => () => abortRef.current?.abort(), [])

  /** Drives a run's event stream with reconnect-on-timeout (spec §2.3). */
  const streamRun = useCallback(async (runId: string, signal: AbortSignal) => {
    while (!signal.aborted) {
      let timedOut = false
      let events
      try {
        events = await agentRunEvents(runId, signal)
      } catch (e) {
        setLive((p) => (p ? { ...p, error: getApiError(e) } : p))
        return
      }
      for await (const ev of events) {
        if (signal.aborted) return
        if (ev.type === 'run_status') {
          setLive((p) => (p ? { ...p, status: ev.status } : p))
        } else if (ev.type === 'delta') {
          setLive((p) => (p ? { ...p, log: p.log + ev.text + '\n' } : p))
        } else if (ev.type === 'sandbox_step') {
          const line = `$ ${ev.command} → ${ev.status}${ev.exit_code != null ? ` (exit ${ev.exit_code})` : ''}`
          setLive((p) => (p ? { ...p, steps: [...p.steps, line] } : p))
        } else if (ev.type === 'done') {
          setLive((p) => (p ? { ...p, status: ev.status } : p))
          qc.invalidateQueries({ queryKey: ['agent-runs', agentId] })
          return
        } else if (ev.type === 'error') {
          if (ev.message.toLowerCase().includes('timeout')) { timedOut = true; break }
          setLive((p) => (p ? { ...p, error: ev.message } : p))
          return
        }
      }
      if (!timedOut) {
        qc.invalidateQueries({ queryKey: ['agent-runs', agentId] })
        return
      }
      // timed out → loop reconnects (no data lost, spec §9 #11)
    }
  }, [agentId, qc])

  const launch = async () => {
    setLaunching(true)
    try {
      const run = await getClient().agents.run(agentId, { prompt: prompt.trim() || null })
      setPrompt('')
      setLive({ runId: run.id, status: run.status, log: '', steps: [], error: null })
      const controller = new AbortController()
      abortRef.current = controller
      streamRun(run.id, controller.signal)
    } catch (e) {
      setLive({ runId: '', status: 'failed', log: '', steps: [], error: getApiError(e) })
    } finally {
      setLaunching(false)
    }
  }

  const cancelLive = async () => {
    if (!live?.runId) return
    const ok = await confirmDestructive({
      title: 'Cancel run',
      message: 'Stop this run? Any in-progress work will be interrupted.',
      confirmLabel: 'Cancel run',
    })
    if (!ok) return
    try {
      await getClient().agents.cancelRun(live.runId)
      setLive((p) => (p ? { ...p, status: 'cancelled' } : p))
    } catch (e) {
      setLive((p) => (p ? { ...p, error: getApiError(e) } : p))
    }
  }

  const openPatch = async (run: AgentRunOut) => {
    if (!run.patch_id) return
    try {
      setPatch(await getClient().sandbox.getPatch(run.patch_id))
    } catch (e) {
      // surface as an alert-less inline note on next render is overkill; log minimal
      setPatch(null)
      await confirmDestructive({ title: 'Patch unavailable', message: getApiError(e), confirmLabel: 'OK', destructive: false })
    }
  }

  const liveStatus = live ? describeRunStatus(live.status) : null

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader title={agentQ.data?.name ?? 'Agent'} onBack={() => router.back()} />
      {agentQ.isLoading ? (
        <LoadingView />
      ) : (
        <ScrollView contentContainerStyle={styles.body}>
          {agentQ.data?.instructions ? (
            <Card>
              <Text style={styles.sectionLabel}>Instructions</Text>
              <Text style={styles.instructions}>{agentQ.data.instructions}</Text>
              <Text style={styles.modelLine}>Model: {agentQ.data.model}</Text>
            </Card>
          ) : null}

          {/* Launch */}
          <Card style={{ gap: 10 }}>
            <Text style={styles.sectionLabel}>Launch a run</Text>
            <TextInput
              style={styles.promptInput}
              value={prompt}
              onChangeText={setPrompt}
              placeholder="Optional prompt for this run…"
              placeholderTextColor={colors.mutedForeground}
              multiline
            />
            <Button title="Run agent" onPress={launch} loading={launching} />
          </Card>

          {/* Live run */}
          {live && liveStatus ? (
            <Card style={{ gap: 8 }}>
              <View style={styles.liveTop}>
                <Text style={styles.sectionLabel}>Current run</Text>
                <Badge label={liveStatus.label} variant={liveStatus.variant} />
              </View>
              {live.steps.length > 0 ? (
                <View style={styles.steps}>
                  {live.steps.map((s, i) => <Text key={i} style={styles.stepLine}>{s}</Text>)}
                </View>
              ) : null}
              {live.log ? <Text style={styles.log}>{live.log}</Text> : null}
              {live.error ? <Text style={styles.err}>{live.error}</Text> : null}
              {liveStatus.inProgress ? (
                <Button title="Cancel run" variant="secondary" onPress={cancelLive} />
              ) : null}
            </Card>
          ) : null}

          {/* History */}
          <Text style={styles.historyHeader}>Run history</Text>
          {runsQ.data && runsQ.data.length > 0 ? (
            runsQ.data.map((run) => <RunRow key={run.id} run={run} onReviewPatch={() => openPatch(run)} />)
          ) : (
            <Text style={styles.emptyHistory}>No runs yet.</Text>
          )}
        </ScrollView>
      )}

      <PatchModal patch={patch} onClose={() => setPatch(null)} onDecided={() => { setPatch(null); runsQ.refetch() }} />
    </SafeAreaView>
  )
}

function RunRow({ run, onReviewPatch }: { run: AgentRunOut; onReviewPatch: () => void }) {
  const status = describeRunStatus(run.status)
  return (
    <Card style={styles.runCard}>
      <View style={styles.runTop}>
        <Badge label={status.label} variant={status.variant} />
        <Text style={styles.runMeta}>{run.trigger} · {run.execution_mode}</Text>
      </View>
      {run.result_summary ? <Text style={styles.runSummary} numberOfLines={3}>{run.result_summary}</Text> : null}
      {run.error ? <Text style={styles.err}>{run.error}</Text> : null}
      {run.patch_id ? (
        <Button title="Review patch" variant="secondary" onPress={onReviewPatch} style={{ marginTop: 8 }} />
      ) : null}
    </Card>
  )
}

function PatchModal({ patch, onClose, onDecided }: { patch: PatchOut | null; onClose: () => void; onDecided: () => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const apply = async () => {
    if (!patch) return
    // Patches are NEVER auto-applied. Applying is an explicit, confirmed,
    // owner-only action.
    const ok = await confirmDestructive({
      title: 'Apply patch',
      message: 'Apply this patch to the workspace? It modifies files in the sandbox. Review the diff first.',
      confirmLabel: 'Apply patch',
    })
    if (!ok) return
    setBusy(true); setError(null)
    try {
      await getClient().sandbox.applyPatch(patch.id)
      onDecided()
    } catch (e) {
      setError(getApiError(e))
    } finally {
      setBusy(false)
    }
  }

  const reject = async () => {
    if (!patch) return
    setBusy(true); setError(null)
    try {
      await getClient().sandbox.rejectPatch(patch.id)
      onDecided()
    } catch (e) {
      setError(getApiError(e))
    } finally {
      setBusy(false)
    }
  }

  const decided = patch ? patch.status !== 'proposed' && patch.status !== 'pending' : false

  return (
    <Modal visible={!!patch} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.container} edges={['top']}>
        <ScreenHeader title="Review patch" onBack={onClose} />
        {patch ? (
          <View style={styles.flex}>
            <View style={styles.patchMeta}>
              <Badge label={patch.status} variant={patch.status === 'applied' ? 'success' : 'warning'} />
              <Text style={styles.runMeta}>{patch.files.length} file(s) · {patch.total_bytes} bytes</Text>
            </View>
            {patch.conflicts.length > 0 ? (
              <Text style={styles.conflict}>⚠️ {patch.conflicts.length} conflict(s) — review carefully before applying.</Text>
            ) : null}
            <ScrollView style={styles.flex} contentContainerStyle={{ padding: spacing.sm }}>
              <ScrollView horizontal>
                <Text style={styles.diff} selectable>{patch.diff || '(no diff content)'}</Text>
              </ScrollView>
            </ScrollView>
            {error ? <Text style={[styles.err, { paddingHorizontal: spacing.sm }]}>{error}</Text> : null}
            {!decided ? (
              <View style={styles.patchActions}>
                <Button title="Reject" variant="secondary" onPress={reject} disabled={busy} style={{ flex: 1 }} />
                <Button title="Apply patch…" onPress={apply} loading={busy} style={{ flex: 1 }} />
              </View>
            ) : (
              <Text style={styles.decidedNote}>This patch has already been {patch.status}.</Text>
            )}
          </View>
        ) : null}
      </SafeAreaView>
    </Modal>
  )
}

const mono = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' })

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  body: { padding: spacing.sm, gap: 12 },
  sectionLabel: { ...typography.labelMd, color: colors.onSurface },
  instructions: { ...typography.bodySm, color: colors.mutedForeground, marginTop: 6 },
  modelLine: { ...typography.labelSm, color: colors.mutedForeground, marginTop: 8 },
  promptInput: { minHeight: 70, backgroundColor: colors.secondarySurface, borderRadius: radii.md, padding: 12, ...typography.bodyMd, fontSize: 15, color: colors.onSurface },
  liveTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  steps: { backgroundColor: colors.neutral, borderRadius: radii.md, padding: 10, gap: 2 },
  stepLine: { fontFamily: mono, fontSize: 12, color: '#D1FAE5' },
  log: { ...typography.bodySm, color: colors.onSurface, fontFamily: mono, fontSize: 12 },
  err: { ...typography.bodySm, color: colors.error },
  historyHeader: { ...typography.labelLg, color: colors.onSurface, marginTop: 4 },
  emptyHistory: { ...typography.bodySm, color: colors.mutedForeground },
  runCard: { gap: 6 },
  runTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  runMeta: { ...typography.labelSm, color: colors.mutedForeground },
  runSummary: { ...typography.bodySm, color: colors.onSurface },
  patchMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.sm },
  conflict: { ...typography.bodySm, color: colors.error, paddingHorizontal: spacing.sm },
  diff: { fontFamily: mono, fontSize: 12, color: colors.onSurface, backgroundColor: colors.secondarySurface, padding: 12, borderRadius: radii.md },
  patchActions: { flexDirection: 'row', gap: 8, padding: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  decidedNote: { ...typography.bodySm, color: colors.mutedForeground, padding: spacing.sm, textAlign: 'center' },
})
