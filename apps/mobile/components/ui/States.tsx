import { View, Text, ActivityIndicator, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Button } from './Button'
import { colors, spacing, typography } from '../../theme/tokens'

/** Centered spinner for a loading screen/section. */
export function LoadingView({ label }: { label?: string }) {
  return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color={colors.primary} />
      {label ? <Text style={styles.sub}>{label}</Text> : null}
    </View>
  )
}

/** Empty state with an icon, title and optional action. */
export function EmptyView({
  icon = 'folder-open-outline',
  title,
  subtitle,
  actionLabel,
  onAction,
}: {
  icon?: keyof typeof Ionicons.glyphMap
  title: string
  subtitle?: string
  actionLabel?: string
  onAction?: () => void
}) {
  return (
    <View style={styles.center}>
      <Ionicons name={icon} size={44} color={colors.muted} />
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.sub}>{subtitle}</Text> : null}
      {actionLabel && onAction ? (
        <Button title={actionLabel} onPress={onAction} style={{ marginTop: spacing.sm }} />
      ) : null}
    </View>
  )
}

/**
 * Error state. For the overloaded 404 the caller passes a "feature
 * unavailable" message; we never render 404 as a permission error.
 */
export function ErrorView({
  title = 'Something went wrong',
  message,
  onRetry,
}: {
  title?: string
  message: string
  onRetry?: () => void
}) {
  return (
    <View style={styles.center}>
      <Ionicons name="alert-circle-outline" size={44} color={colors.error} />
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.sub}>{message}</Text>
      {onRetry ? (
        <Button title="Try again" variant="secondary" onPress={onRetry} style={{ marginTop: spacing.sm }} />
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
    gap: 8,
  },
  title: { ...typography.labelLg, color: colors.onSurface, textAlign: 'center', marginTop: 4 },
  sub: { ...typography.bodySm, color: colors.mutedForeground, textAlign: 'center', maxWidth: 320 },
})
