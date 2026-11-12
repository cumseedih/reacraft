import { View, Text, Pressable, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { colors, spacing, typography } from '../../theme/tokens'

interface Action {
  icon: keyof typeof Ionicons.glyphMap
  onPress: () => void
  accessibilityLabel: string
}

/** Consistent screen header with optional back button and trailing actions. */
export function ScreenHeader({
  title,
  onBack,
  actions = [],
}: {
  title: string
  onBack?: () => void
  actions?: Action[]
}) {
  return (
    <View style={styles.header}>
      {onBack ? (
        <Pressable onPress={onBack} hitSlop={10} style={styles.backBtn} accessibilityLabel="Go back">
          <Ionicons name="chevron-back" size={24} color={colors.onSurface} />
        </Pressable>
      ) : (
        <View style={styles.backBtn} />
      )}
      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>
      <View style={styles.actions}>
        {actions.map((a, i) => (
          <Pressable
            key={i}
            onPress={a.onPress}
            hitSlop={10}
            style={styles.actionBtn}
            accessibilityLabel={a.accessibilityLabel}
          >
            <Ionicons name={a.icon} size={22} color={colors.primary} />
          </Pressable>
        ))}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    gap: 4,
  },
  backBtn: { width: 32, height: 32, alignItems: 'flex-start', justifyContent: 'center' },
  title: { ...typography.labelLg, color: colors.onSurface, flex: 1, fontWeight: '600' },
  actions: { flexDirection: 'row', gap: 4 },
  actionBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
})
