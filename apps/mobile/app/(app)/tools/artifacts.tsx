import { useState } from 'react'
import { View, Text, FlatList, StyleSheet, Modal, ScrollView, Platform } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useQuery } from '@tanstack/react-query'
import type { ArtifactOut } from '@kroex/api'
import { getClient } from '../../../lib/client'
import { getApiError } from '../../../lib/errors'
import { ScreenHeader } from '../../../components/ui/ScreenHeader'
import { Card } from '../../../components/ui/Card'
import { Badge } from '../../../components/ui/Badge'
import { LoadingView, EmptyView, ErrorView } from '../../../components/ui/States'
import { colors, radii, spacing, typography } from '../../../theme/tokens'

export default function ArtifactsScreen() {
  const [selected, setSelected] = useState<ArtifactOut | null>(null)
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['artifacts'],
    queryFn: () => getClient().artifacts.list(),
    retry: 1,
  })

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader title="Artifacts" onBack={() => router.back()} />
      {isLoading ? (
        <LoadingView label="Loading artifacts…" />
      ) : isError ? (
        <ErrorView message={getApiError(error)} onRetry={refetch} />
      ) : !data || data.length === 0 ? (
        <EmptyView
          icon="documents-outline"
          title="No artifacts yet"
          subtitle="Code and documents KROEX produces in chat appear here. Artifacts are read-only."
        />
      ) : (
        <FlatList
          data={data}
          keyExtractor={(a) => a.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <Card onPress={() => setSelected(item)} style={styles.card}>
              <View style={styles.cardRow}>
                <Ionicons name={item.type === 'code' ? 'code-slash-outline' : 'document-text-outline'} size={20} color={colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
                  <View style={styles.badges}>
                    <Badge label={item.type} variant="secondary" />
                    {item.language ? <Badge label={item.language} variant="muted" /> : null}
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
              </View>
            </Card>
          )}
        />
      )}

      <Modal visible={!!selected} animationType="slide" onRequestClose={() => setSelected(null)}>
        <SafeAreaView style={styles.container} edges={['top']}>
          <ScreenHeader title={selected?.title ?? 'Artifact'} onBack={() => setSelected(null)} />
          <ScrollView contentContainerStyle={styles.viewer} horizontal={false}>
            <ScrollView horizontal>
              <Text style={styles.code} selectable>{selected?.content}</Text>
            </ScrollView>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  list: { padding: spacing.sm, gap: 8 },
  card: {},
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { ...typography.labelMd, color: colors.onSurface },
  badges: { flexDirection: 'row', gap: 6, marginTop: 4 },
  viewer: { padding: spacing.sm },
  code: {
    ...typography.bodySm,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
    color: colors.onSurface,
    backgroundColor: colors.secondarySurface,
    padding: 12,
    borderRadius: radii.md,
  },
})
