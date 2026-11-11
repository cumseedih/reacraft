import { useState } from 'react'
import { View, Text, FlatList, StyleSheet, Modal, Pressable, ScrollView } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { filterBuiltSandboxImages, type SessionOut, type WorkspaceOut } from '@kroex/api'
import { getClient } from '../../../../lib/client'
import { getApiError, isUnavailable, FEATURE_UNAVAILABLE_MESSAGE } from '../../../../lib/errors'
import { describeSessionState } from '../../../../lib/status'
import { ScreenHeader } from '../../../../components/ui/ScreenHeader'
import { Card } from '../../../../components/ui/Card'
import { Button } from '../../../../components/ui/Button'
import { Input } from '../../../../components/ui/Input'
import { Badge } from '../../../../components/ui/Badge'
import { LoadingView, EmptyView, ErrorView } from '../../../../components/ui/States'
import { colors, radii, spacing, typography } from '../../../../theme/tokens'

export default function SandboxScreen() {
  const qc = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)

  const configQ = useQuery({ queryKey: ['sandbox-config'], queryFn: () => getClient().sandbox.getConfig(), retry: 1 })
  const sessionsQ = useQuery({ queryKey: ['sandbox-sessions'], queryFn: () => getClient().sandbox.listSessions(), retry: 1 })

  const unavailable = isUnavailable(configQ.error) || isUnavailable(sessionsQ.error)

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader
        title="Sandbox"
        onBack={() => router.back()}
        actions={unavailable ? [] : [{ icon: 'add', onPress: () => setCreateOpen(true), accessibilityLabel: 'New session' }]}
      />

      {configQ.data ? (
        <View style={styles.limits}>
          <Text style={styles.limitsText}>
            Runtime: {configQ.data.runtime} · Images: {filterBuiltSandboxImages(configQ.data.images).join(', ') || '—'}
          </Text>
          {Object.keys(configQ.data.limits).length > 0 ? (
            <Text style={styles.limitsText}>
              Plan limits: {Object.entries(configQ.data.limits).map(([k, v]) => `${k}=${v}`).join('  ')}
            </Text>
          ) : null}
        </View>
      ) : null}

      {sessionsQ.isLoading ? (
        <LoadingView label="Loading sessions…" />
      ) : unavailable ? (
        <EmptyView icon="cube-outline" title="Sandbox unavailable" subtitle={FEATURE_UNAVAILABLE_MESSAGE} />
      ) : sessionsQ.isError ? (
        <ErrorView message={getApiError(sessionsQ.error)} onRetry={sessionsQ.refetch} />
      ) : !sessionsQ.data || sessionsQ.data.length === 0 ? (
        <EmptyView
          icon="cube-outline"
          title="No sessions"
          subtitle="Create an isolated sandbox session to run commands. Only built images (python, node) are available."
          actionLabel="New session"
          onAction={() => setCreateOpen(true)}
        />
      ) : (
        <FlatList
          data={sessionsQ.data}
          keyExtractor={(s) => s.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => <SessionRow session={item} />}
        />
      )}

      <CreateSessionModal
        visible={createOpen}
        images={configQ.data ? filterBuiltSandboxImages(configQ.data.images) : ['python', 'node']}
        onClose={() => setCreateOpen(false)}
        onCreated={() => {
          setCreateOpen(false)
          qc.invalidateQueries({ queryKey: ['sandbox-sessions'] })
        }}
      />
    </SafeAreaView>
  )
}

function SessionRow({ session }: { session: SessionOut }) {
  const state = describeSessionState(session.state)
  return (
    <Card onPress={() => router.push(`/(app)/tools/sandbox/${session.id}`)} style={styles.card}>
      <View style={styles.cardRow}>
        <Ionicons name="cube-outline" size={20} color={colors.primary} />
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle} numberOfLines={1}>{session.image}</Text>
          <Text style={styles.cardSub}>{session.network_policy} · {session.runtime}</Text>
        </View>
        <Badge label={state.label} variant={state.variant} />
        <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
      </View>
    </Card>
  )
}

function CreateSessionModal({
  visible,
  images,
  onClose,
  onCreated,
}: {
  visible: boolean
  images: string[]
  onClose: () => void
  onCreated: () => void
}) {
  const [workspaceName, setWorkspaceName] = useState('')
  const [image, setImage] = useState<string>(images[0] ?? 'python')
  const [error, setError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: async () => {
      // Create a workspace, then a session in it.
      const ws: WorkspaceOut = await getClient().sandbox.createWorkspace({ name: workspaceName.trim() })
      return getClient().sandbox.createSession({ workspace_id: ws.id, image })
    },
    onSuccess: () => { setWorkspaceName(''); setError(null); onCreated() },
    onError: (e) => setError(getApiError(e)),
  })

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.handle} />
          <ScrollView keyboardShouldPersistTaps="handled">
            <Text style={styles.sheetTitle}>New sandbox session</Text>
            {error ? <Text style={styles.err}>{error}</Text> : null}
            <Text style={styles.label}>Workspace name</Text>
            <Input value={workspaceName} onChangeText={setWorkspaceName} placeholder="my-workspace" autoCapitalize="none" />
            <Text style={styles.label}>Image</Text>
            <View style={styles.chips}>
              {images.map((img) => (
                <Pressable key={img} style={[styles.chip, image === img && styles.chipActive]} onPress={() => setImage(img)}>
                  <Text style={[styles.chipText, image === img && styles.chipTextActive]}>{img}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.note}>
              Sessions run under gVisor isolation with restricted egress. Only built images are shown.
            </Text>
            <Button title="Create session" onPress={() => mutation.mutate()} loading={mutation.isPending} disabled={!workspaceName.trim()} style={{ marginTop: spacing.sm }} />
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  limits: { paddingHorizontal: spacing.sm, paddingTop: 10, gap: 2 },
  limitsText: { ...typography.labelSm, color: colors.mutedForeground },
  list: { padding: spacing.sm, gap: 8 },
  card: {},
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardTitle: { ...typography.labelMd, color: colors.onSurface },
  cardSub: { ...typography.labelSm, color: colors.mutedForeground, marginTop: 2 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: radii.xl, borderTopRightRadius: radii.xl, padding: spacing.sm, paddingBottom: spacing.md, maxHeight: '82%' },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.muted, marginBottom: 8 },
  sheetTitle: { ...typography.labelLg, color: colors.onSurface, marginBottom: 8 },
  label: { ...typography.labelMd, color: colors.onSurface, marginTop: 12, marginBottom: 6 },
  chips: { flexDirection: 'row', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radii.full, borderWidth: 1, borderColor: colors.border },
  chipActive: { backgroundColor: 'rgba(0,113,227,0.08)', borderColor: colors.primary },
  chipText: { ...typography.labelMd, color: colors.mutedForeground },
  chipTextActive: { color: colors.primary },
  note: { ...typography.labelSm, color: colors.mutedForeground, marginTop: 10 },
  err: { ...typography.bodySm, color: colors.error, marginBottom: 4 },
})
