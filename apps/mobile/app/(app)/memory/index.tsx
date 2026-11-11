import { useState } from 'react'
import { View, Text, FlatList, StyleSheet, Pressable, Modal, ScrollView } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { MemoryOut, MemorySearchResult } from '@kroex/api'
import { getClient } from '../../../lib/client'
import { getApiError } from '../../../lib/errors'
import { confirmDestructive } from '../../../lib/confirm'
import { describeRetrievalMethod } from '../../../lib/status'
import { ScreenHeader } from '../../../components/ui/ScreenHeader'
import { Card } from '../../../components/ui/Card'
import { Button } from '../../../components/ui/Button'
import { Input } from '../../../components/ui/Input'
import { Badge } from '../../../components/ui/Badge'
import { LoadingView, EmptyView, ErrorView } from '../../../components/ui/States'
import { colors, radii, spacing, typography } from '../../../theme/tokens'

export default function MemoryScreen() {
  const qc = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [searchResult, setSearchResult] = useState<MemorySearchResult | null>(null)
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)

  const listQ = useQuery({
    queryKey: ['memory'],
    queryFn: () => getClient().memory.list(),
    retry: 1,
  })

  const deleteMut = useMutation({
    mutationFn: (memoryId: string) => getClient().memory.remove(memoryId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['memory'] }),
  })

  const runSearch = async () => {
    const q = query.trim()
    if (!q) { setSearchResult(null); return }
    setSearching(true); setSearchError(null)
    try {
      setSearchResult(await getClient().memory.search(q, 10))
    } catch (e) {
      setSearchError(getApiError(e))
    } finally {
      setSearching(false)
    }
  }

  const confirmDelete = async (m: MemoryOut) => {
    const ok = await confirmDestructive({
      title: 'Delete memory',
      message: 'Delete this memory? This cannot be undone.',
      confirmLabel: 'Delete',
    })
    if (ok) deleteMut.mutate(m.id)
  }

  const method = searchResult ? describeRetrievalMethod(searchResult.method) : null

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader
        title="Memory"
        actions={[{ icon: 'add', onPress: () => setCreateOpen(true), accessibilityLabel: 'New memory' }]}
      />

      <View style={styles.searchRow}>
        <Input
          value={query}
          onChangeText={setQuery}
          placeholder="Search memory…"
          returnKeyType="search"
          onSubmitEditing={runSearch}
          style={{ flex: 1 }}
        />
        <Button title="Search" variant="secondary" onPress={runSearch} loading={searching} />
      </View>

      {searchResult && method ? (
        <View style={styles.searchResults}>
          <View style={styles.methodRow}>
            <Badge label={method.label} variant={method.variant} />
            <Pressable onPress={() => { setSearchResult(null); setQuery('') }}>
              <Text style={styles.clear}>Clear</Text>
            </Pressable>
          </View>
          <Text style={styles.methodNote}>{method.description}</Text>
          {searchResult.contents.length === 0 ? (
            <Text style={styles.emptySearch}>No matches.</Text>
          ) : (
            searchResult.contents.map((c, i) => (
              <Card key={i} style={{ marginTop: 8 }}>
                <Text style={styles.memoryText}>{c}</Text>
              </Card>
            ))
          )}
        </View>
      ) : searchError ? (
        <Text style={styles.err}>{searchError}</Text>
      ) : listQ.isLoading ? (
        <LoadingView label="Loading memory…" />
      ) : listQ.isError ? (
        <ErrorView message={getApiError(listQ.error)} onRetry={listQ.refetch} />
      ) : !listQ.data || listQ.data.length === 0 ? (
        <EmptyView
          icon="bulb-outline"
          title="No memories yet"
          subtitle="Save facts and preferences KROEX should remember across conversations."
          actionLabel="Add memory"
          onAction={() => setCreateOpen(true)}
        />
      ) : (
        <FlatList
          data={listQ.data}
          keyExtractor={(m) => m.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <Card style={styles.memCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.memoryText}>{item.content}</Text>
                <Text style={styles.memSource}>{item.source}</Text>
              </View>
              <Pressable hitSlop={8} onPress={() => confirmDelete(item)} accessibilityLabel="Delete memory">
                <Ionicons name="trash-outline" size={18} color={colors.error} />
              </Pressable>
            </Card>
          )}
        />
      )}

      <CreateMemoryModal
        visible={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => {
          setCreateOpen(false)
          qc.invalidateQueries({ queryKey: ['memory'] })
        }}
      />
    </SafeAreaView>
  )
}

function CreateMemoryModal({ visible, onClose, onCreated }: { visible: boolean; onClose: () => void; onCreated: () => void }) {
  const [content, setContent] = useState('')
  const mutation = useMutation({
    mutationFn: () => getClient().memory.create({ content: content.trim(), source: 'manual' }),
    onSuccess: () => { setContent(''); onCreated() },
  })

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.handle} />
          <ScrollView keyboardShouldPersistTaps="handled">
            <Text style={styles.sheetTitle}>New memory</Text>
            {mutation.isError ? <Text style={styles.err}>{getApiError(mutation.error)}</Text> : null}
            <Input value={content} onChangeText={setContent} placeholder="Something KROEX should remember…" multiline style={{ minHeight: 100 }} />
            <Button title="Save memory" onPress={() => mutation.mutate()} loading={mutation.isPending} disabled={!content.trim()} style={{ marginTop: spacing.sm }} />
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  searchRow: { flexDirection: 'row', gap: 8, paddingHorizontal: spacing.sm, paddingTop: spacing.sm, alignItems: 'center' },
  searchResults: { paddingHorizontal: spacing.sm, paddingTop: spacing.sm, flex: 1 },
  methodRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  methodNote: { ...typography.labelSm, color: colors.mutedForeground, marginTop: 6 },
  emptySearch: { ...typography.bodySm, color: colors.mutedForeground, marginTop: spacing.sm },
  clear: { ...typography.labelMd, color: colors.primary },
  list: { padding: spacing.sm, gap: 8 },
  memCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  memoryText: { ...typography.bodyMd, fontSize: 15, color: colors.onSurface },
  memSource: { ...typography.labelSm, color: colors.mutedForeground, marginTop: 4 },
  err: { ...typography.bodySm, color: colors.error, padding: spacing.sm },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: radii.xl, borderTopRightRadius: radii.xl, padding: spacing.sm, paddingBottom: spacing.md, maxHeight: '80%' },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.muted, marginBottom: 8 },
  sheetTitle: { ...typography.labelLg, color: colors.onSurface, marginBottom: 8 },
})
