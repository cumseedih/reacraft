import { View, Text, StyleSheet } from 'react-native'
import { colors, radii, typography } from '../../theme/tokens'
import type { BadgeVariant } from '../../lib/status'

const VARIANT_COLORS: Record<BadgeVariant, { bg: string; fg: string }> = {
  default:     { bg: 'rgba(0,113,227,0.12)',  fg: colors.primary },
  secondary:   { bg: colors.secondarySurface, fg: colors.onSurface },
  muted:       { bg: colors.secondarySurface, fg: colors.mutedForeground },
  warning:     { bg: 'rgba(245,158,11,0.14)', fg: '#B45309' },
  success:     { bg: 'rgba(16,185,129,0.14)', fg: '#047857' },
  destructive: { bg: 'rgba(217,45,32,0.12)',  fg: colors.error },
}

export function Badge({ label, variant = 'muted' }: { label: string; variant?: BadgeVariant }) {
  const c = VARIANT_COLORS[variant]
  return (
    <View style={[styles.badge, { backgroundColor: c.bg }]}>
      <Text style={[styles.text, { color: c.fg }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    borderRadius: radii.full,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  text: { ...typography.labelSm },
})
