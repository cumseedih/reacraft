import { useState } from 'react'
import { View, Text, FlatList, StyleSheet, Pressable } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import * as DocumentPicker from 'expo-document-picker'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  uploadProjectFile,
  PROJECT_FILE_EXTENSION_TO_CONTENT_TYPE,
  type FileOut,
} from '@kroex/api'
import { getClient } from '../../../lib/client'
import { getApiError } from '../../../lib/errors'
import { confirmDestructive } from '../../../lib/confirm'
import { ScreenHeader } from '../../../components/ui/ScreenHeader'
import { Card } from '../../../components/ui/Card'
import { Button } from '../../../components/ui/Button'
import { LoadingView, EmptyView, ErrorView } from '../../../components/ui/States'
import { colors, spacing, typography } from '../../../theme/tokens'

const ALLOWED_EXTENSIONS = Object.keys(PROJECT_FILE_EXTENSION_TO_CONTENT_TYPE)

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

export default function ProjectDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const projectId = String(id)
  const qc = useQueryClient()
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)

  const projectQ = useQuery({
    queryKey: ['projects'],
    queryFn: () => getClient().projects.list(),
    retry: 1,
  })
  const project = projectQ.data?.find((p) => p.id === projectId)

  const filesQ = useQuery({
    queryKey: ['project-files', projectId],
    queryFn: () => getClient().projects.listFiles(projectId),
    retry: 1,
  })

  const deleteFile = useMutation({
    mutationFn: (fileId: string) => getClient().projects.deleteFile(projectId, fileId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['project-files', projectId] }),
  })

  const deleteProject = useMutation({
    mutationFn: () => getClient().projects.remove(projectId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects'] })
      router.back()
    },
  })

  const handleUpload = async () => {
    setUploadError(null)
    try {
      const res = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true })
      if (res.canceled || !res.assets?.[0]) return
      const asset = res.assets[0]
      const lower = asset.name.toLowerCase()
      const ext = lower.slice(lower.lastIndexOf('.'))
      if (!ALLOWED_EXTENSIONS.includes(ext)) {
        setUploadError(`Unsupported file type. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`)
        return
      }
      setUploading(true)
      const form = new FormData()
      // React Native FormData file part.
      form.append('file', {
        uri: asset.uri,
        name: asset.name,
        type: asset.mimeType || PROJECT_FILE_EXTENSION_TO_CONTENT_TYPE[ext],
      } as unknown as Blob)
      await uploadProjectFile(getClient().config, projectId, form)
      qc.invalidateQueries({ queryKey: ['project-files', projectId] })
    } catch (e) {
      setUploadError(getApiError(e))
    } finally {
      setUploading(false)
    }
  }

  const confirmDeleteFile = async (file: FileOut) => {
    const ok = await confirmDestructive({
      title: 'Delete file',
      message: `Delete "${file.name}"? This cannot be undone.`,
      confirmLabel: 'Delete',
    })
    if (ok) deleteFile.mutate(file.id)
  }

  const confirmDeleteProject = async () => {
    const ok = await confirmDestructive({
      title: 'Delete project',
      message: `Delete "${project?.name ?? 'this project'}"? This removes the project and its files.`,
      confirmLabel: 'Delete',
    })
    if (ok) deleteProject.mutate()
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader
        title={project?.name ?? 'Project'}
        onBack={() => router.back()}
        actions={[{ icon: 'trash-outline', onPress: confirmDeleteProject, accessibilityLabel: 'Delete project' }]}
      />
      {project?.description ? <Text style={styles.desc}>{project.description}</Text> : null}

      <View style={styles.filesHeader}>
        <Text style={styles.sectionTitle}>Files</Text>
        <Button title={uploading ? 'Uploading…' : 'Upload'} variant="secondary" onPress={handleUpload} loading={uploading} />
      </View>
      {uploadError ? <Text style={styles.err}>{uploadError}</Text> : null}

      {filesQ.isLoading ? (
        <LoadingView />
      ) : filesQ.isError ? (
        <ErrorView message={getApiError(filesQ.error)} onRetry={filesQ.refetch} />
      ) : !filesQ.data || filesQ.data.length === 0 ? (
        <EmptyView
          icon="document-outline"
          title="No files"
          subtitle={`Upload ${ALLOWED_EXTENSIONS.join(', ')} files for this project.`}
        />
      ) : (
        <FlatList
          data={filesQ.data}
          keyExtractor={(f) => f.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <Card style={styles.fileCard}>
              <Ionicons name="document-text-outline" size={20} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.fileName} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.fileMeta}>
                  {formatBytes(item.size)} · {item.chunk_count > 0 ? `${item.chunk_count} chunks` : 'processing…'}
                </Text>
              </View>
              <Pressable hitSlop={8} onPress={() => confirmDeleteFile(item)} accessibilityLabel="Delete file">
                <Ionicons name="trash-outline" size={18} color={colors.error} />
              </Pressable>
            </Card>
          )}
        />
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  desc: { ...typography.bodySm, color: colors.mutedForeground, paddingHorizontal: spacing.sm, paddingTop: 10 },
  filesHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.sm, paddingTop: spacing.sm, paddingBottom: 6 },
  sectionTitle: { ...typography.labelLg, color: colors.onSurface },
  list: { padding: spacing.sm, gap: 8 },
  fileCard: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  fileName: { ...typography.labelMd, color: colors.onSurface },
  fileMeta: { ...typography.labelSm, color: colors.mutedForeground, marginTop: 2 },
  err: { ...typography.bodySm, color: colors.error, paddingHorizontal: spacing.sm },
})
