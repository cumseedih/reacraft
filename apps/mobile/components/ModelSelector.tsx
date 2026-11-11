import { Modal, View, Text, Pressable, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { MOBILE_MODELS } from '../lib/models'
import { colors, radii, spacing, typography } from '../theme/tokens'

/**
 * Bottom-sheet model picker. Lists ONLY the supported KROEX tiers (sourced
 * from @kroex/api via lib/models) — never a legacy/unsupported provider id.
 */
export function ModelSelector({
  visible,
  selectedModel,
  onSelect,
  onClose,
}: {
  visible: boolean
  selectedModel: string
  onSelect: (id: string) => void
  onClose: () => void
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.handle} />
          <Text style={styles.title}>Choose a model</Text>
          {MOBILE_MODELS.map((m) => {
            const selected = m.id === selectedModel
            return (
              <Pressable
                key={m.id}
                style={[styles.row, selected && styles.rowSelected]}
                onPress={() => {
                  onSelect(m.id)
                  onClose()
                }}
              >
                <Ionicons name={m.icon as keyof typeof Ionicons.glyphMap} size={22} color={colors.primary} />
                <View style={styles.rowBody}>
                  <View style={styles.rowTop}>
                    <Text style={styles.name}>{m.name}</Text>
                    {selected ? <Ionicons name="checkmark" size={18} color={colors.primary} /> : null}
                  </View>
                  <Text style={styles.desc}>{m.description}</Text>
                  <Text style={styles.ctx}>{m.contextLabel}</Text>
                </View>
              </Pressable>
            )
          })}
          <Text style={styles.footnote}>
            Model selection applies to this conversation. Set a default in Account.
          </Text>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    padding: spacing.sm,
    paddingBottom: spacing.md,
    gap: 8,
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.muted, marginBottom: 8 },
  title: { ...typography.labelLg, color: colors.onSurface, marginBottom: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 12,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  rowSelected: { backgroundColor: 'rgba(0,113,227,0.06)', borderColor: 'rgba(0,113,227,0.3)' },
  rowBody: { flex: 1, gap: 2 },
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  name: { ...typography.labelMd, color: colors.onSurface },
  desc: { ...typography.bodySm, color: colors.mutedForeground },
  ctx: { ...typography.labelSm, color: colors.mutedForeground, marginTop: 2 },
  footnote: { ...typography.labelSm, color: colors.mutedForeground, marginTop: 8, textAlign: 'center' },
})
