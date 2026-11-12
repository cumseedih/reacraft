import { useState } from 'react'
import { View, Text, FlatList, StyleSheet, Modal, Pressable, ScrollView } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { AgentOut } from '@kroex/api'
import { getClient } from '../../../../lib/client'
import { getApiError, isUnavailable, FEATURE_UNAVAILABLE_MESSAGE } from '../../../../lib/errors'
import { useSettingsStore } from '../../../../store/settings'
import { MOBILE_MODELS } from '../../../../lib/models'
import { ScreenHeader } from '../../../../components/ui/ScreenHeader'
import { Card } from '../../../../components/ui/Card'
import { Button } from '../../../../components/ui/Button'
import { Input } from '../../../../components/ui/Input'
import { Badge } from '../../../../components/ui/Badge'
import { LoadingView, EmptyView, ErrorView } from '../../../../components/ui/States'
import { colors, radii, spacing, typography } from '../../../../theme/tokens'

export default function AgentsScreen() {
  const qc = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['agents'],
    queryFn: () => getClient().agents.list(),
    retry: 1,
  })

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader
        title="Agents"
        onBack={() => router.back()}
        actions={[{ icon: 'add', onPress: () => setCreateOpen(true), accessibilityLabel: 'New agent' }]}
      />
      {isLoading ? (
        <LoadingView label="Loading agents…" />
      ) : isError ? (
        isUnavailable(error) ? (
          <EmptyView icon="git-network-outline" title="Agents unavailable" subtitle={FEATURE_UNAVAILABLE_MESSAGE} />
        ) : (
          <ErrorView message={getApiError(error)} onRetry={refetch} />
        )
      ) : !data || data.length === 0 ? (
        <EmptyView
          icon="git-network-outline"
          title="No agents yet"
          subtitle="Create an agent with instructions and a model to run tasks on demand."
          actionLabel="Create agent"
          onAction={() => setCreateOpen(true)}
        />
      ) : (
        <FlatList
          data={data}
          keyExtractor={(a) => a.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => <AgentRow agent={item} />}
        />
      )}
      <CreateAgentModal
        visible={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => { setCreateOpen(false); qc.invalidateQueries({ queryKey: ['agents'] }) }}
      />
    </SafeAreaView>
  )
}

function AgentRow({ agent }: { agent: AgentOut }) {
  return (
    <Card onPress={() => router.push(`/(app)/tools/agents/${agent.id}`)} style={styles.card}>
      <View style={styles.cardRow}>
        <Ionicons name="git-network-outline" size={20} color={colors.primary} />
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle} numberOfLines={1}>{agent.name}</Text>
          <Text style={styles.cardSub} numberOfLines={1}>{agent.model}</Text>
        </View>
        <Badge label={agent.enabled ? 'Enabled' : 'Disabled'} variant={agent.enabled ? 'success' : 'muted'} />
        <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
      </View>
    </Card>
  )
}

function CreateAgentModal({ visible, onClose, onCreated }: { visible: boolean; onClose: () => void; onCreated: () => void }) {
  const defaultModel = useSettingsStore((s) => s.defaultModel)
  const [name, setName] = useState('')
  const [instructions, setInstructions] = useState('')
  const [model, setModel] = useState<string>(defaultModel)

  const mutation = useMutation({
    mutationFn: () => getClient().agents.create({ name: name.trim(), instructions: instructions.trim(), model }),
    onSuccess: () => { setName(''); setInstructions(''); onCreated() },
  })

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.handle} />
          <ScrollView keyboardShouldPersistTaps="handled">
            <Text style={styles.sheetTitle}>New agent</Text>
            {mutation.isError ? <Text style={styles.err}>{getApiError(mutation.error)}</Text> : null}
            <Text style={styles.label}>Name</Text>
            <Input value={name} onChangeText={setName} placeholder="Research assistant" />
            <Text style={styles.label}>Instructions</Text>
            <Input value={instructions} onChangeText={setInstructions} placeholder="What should this agent do?" multiline style={{ minHeight: 90 }} />
            <Text style={styles.label}>Model</Text>
            <View style={styles.modelRow}>
              {MOBILE_MODELS.map((m) => (
                <Pressable key={m.id} style={[styles.modelChip, model === m.id && styles.modelChipActive]} onPress={() => setModel(m.id)}>
                  <Text style={[styles.modelChipText, model === m.id && styles.modelChipTextActive]}>{m.name}</Text>
                </Pressable>
              ))}
            </View>
            <Button title="Create agent" onPress={() => mutation.mutate()} loading={mutation.isPending} disabled={!name.trim()} style={{ marginTop: spacing.sm }} />
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  list: { padding: spacing.sm, gap: 8 },
  card: {},
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardTitle: { ...typography.labelMd, color: colors.onSurface },
  cardSub: { ...typography.labelSm, color: colors.mutedForeground, marginTop: 2 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: radii.xl, borderTopRightRadius: radii.xl, padding: spacing.sm, paddingBottom: spacing.md, maxHeight: '86%' },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.muted, marginBottom: 8 },
  sheetTitle: { ...typography.labelLg, color: colors.onSurface, marginBottom: 8 },
  label: { ...typography.labelMd, color: colors.onSurface, marginTop: 12, marginBottom: 6 },
  err: { ...typography.bodySm, color: colors.error, marginBottom: 4 },
  modelRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  modelChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: radii.full, borderWidth: 1, borderColor: colors.border },
  modelChipActive: { backgroundColor: 'rgba(0,113,227,0.08)', borderColor: colors.primary },
  modelChipText: { ...typography.labelSm, color: colors.mutedForeground },
  modelChipTextActive: { color: colors.primary },
})
