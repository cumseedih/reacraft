import { useState } from 'react'
import { View, Text, FlatList, StyleSheet, Modal, Pressable, ScrollView } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { ProjectOut } from '@kroex/api'
import { getClient } from '../../../lib/client'
import { getApiError } from '../../../lib/errors'
import { ScreenHeader } from '../../../components/ui/ScreenHeader'
import { Card } from '../../../components/ui/Card'
import { Button } from '../../../components/ui/Button'
import { Input } from '../../../components/ui/Input'
import { LoadingView, EmptyView, ErrorView } from '../../../components/ui/States'
import { colors, radii, spacing, typography } from '../../../theme/tokens'

export default function ProjectsScreen() {
  const qc = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['projects'],
    queryFn: () => getClient().projects.list(),
    retry: 1,
  })

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader
        title="Projects"
        actions={[{ icon: 'add', onPress: () => setCreateOpen(true), accessibilityLabel: 'New project' }]}
      />
      {isLoading ? (
        <LoadingView label="Loading projects…" />
      ) : isError ? (
        <ErrorView message={getApiError(error)} onRetry={refetch} />
      ) : !data || data.length === 0 ? (
        <EmptyView
          icon="folder-open-outline"
          title="No projects yet"
          subtitle="Create a project to group conversations, files and a custom system prompt."
          actionLabel="Create project"
          onAction={() => setCreateOpen(true)}
        />
      ) : (
        <FlatList
          data={data}
          keyExtractor={(p) => p.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => <ProjectRow project={item} />}
        />
      )}
      <CreateProjectModal
        visible={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => {
          setCreateOpen(false)
          qc.invalidateQueries({ queryKey: ['projects'] })
        }}
      />
    </SafeAreaView>
  )
}

function ProjectRow({ project }: { project: ProjectOut }) {
  return (
    <Card onPress={() => router.push(`/(app)/projects/${project.id}`)} style={styles.card}>
      <View style={styles.cardRow}>
        <View style={[styles.colorDot, { backgroundColor: project.color || colors.primary }]} />
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle} numberOfLines={1}>{project.name}</Text>
          {project.description ? (
            <Text style={styles.cardDesc} numberOfLines={2}>{project.description}</Text>
          ) : null}
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
      </View>
    </Card>
  )
}

function CreateProjectModal({
  visible,
  onClose,
  onCreated,
}: {
  visible: boolean
  onClose: () => void
  onCreated: () => void
}) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [systemPrompt, setSystemPrompt] = useState('')

  const mutation = useMutation({
    mutationFn: () =>
      getClient().projects.create({
        name: name.trim(),
        description: description.trim() || null,
        system_prompt: systemPrompt.trim() || null,
      }),
    onSuccess: () => {
      setName(''); setDescription(''); setSystemPrompt('')
      onCreated()
    },
  })

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.handle} />
          <ScrollView keyboardShouldPersistTaps="handled">
            <Text style={styles.sheetTitle}>New project</Text>
            {mutation.isError ? <Text style={styles.err}>{getApiError(mutation.error)}</Text> : null}
            <Text style={styles.label}>Name</Text>
            <Input value={name} onChangeText={setName} placeholder="My project" />
            <Text style={styles.label}>Description (optional)</Text>
            <Input value={description} onChangeText={setDescription} placeholder="What is this for?" multiline />
            <Text style={styles.label}>System prompt (optional)</Text>
            <Input value={systemPrompt} onChangeText={setSystemPrompt} placeholder="Custom instructions for this project" multiline style={{ minHeight: 80 }} />
            <Button
              title="Create project"
              onPress={() => mutation.mutate()}
              loading={mutation.isPending}
              disabled={!name.trim()}
              style={{ marginTop: spacing.sm }}
            />
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  list: { padding: spacing.sm, gap: 10 },
  card: {},
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  colorDot: { width: 12, height: 12, borderRadius: 6 },
  cardTitle: { ...typography.labelMd, color: colors.onSurface },
  cardDesc: { ...typography.bodySm, color: colors.mutedForeground, marginTop: 2 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: radii.xl, borderTopRightRadius: radii.xl, padding: spacing.sm, paddingBottom: spacing.md, maxHeight: '86%' },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.muted, marginBottom: 8 },
  sheetTitle: { ...typography.labelLg, color: colors.onSurface, marginBottom: 8 },
  label: { ...typography.labelMd, color: colors.onSurface, marginTop: 12, marginBottom: 6 },
  err: { ...typography.bodySm, color: colors.error, marginBottom: 4 },
})
