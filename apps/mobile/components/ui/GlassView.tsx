import { BlurView } from 'expo-blur'
import { StyleSheet, View, type ViewProps } from 'react-native'
import { radii } from '../../theme/tokens'

interface GlassViewProps extends ViewProps {
  /** Blur strength (0–100). */
  intensity?: number
  radius?: number
  tint?: 'light' | 'dark' | 'default' | 'systemUltraThinMaterialLight'
  /** Hairline border + top edge highlight for the "pane of glass" read. */
  bordered?: boolean
}

/**
 * Liquid Glass surface backed by a real native blur:
 *  - iOS: native UIVisualEffectView material.
 *  - Android: real backdrop blur via expo-blur's experimental Dimezis method.
 *  - Web: backdrop-filter (expo-blur maps to it).
 * The blur samples whatever is rendered behind this view, so place it OVER the
 * content you want blurred (e.g. the message list) — transparency alone is not used.
 */
export function GlassView({
  children,
  style,
  intensity = 45,
  radius = radii.xl,
  tint = 'light',
  bordered = true,
  ...rest
}: GlassViewProps) {
  return (
    <View style={[{ borderRadius: radius, overflow: 'hidden' }, style]} {...rest}>
      <BlurView
        intensity={intensity}
        tint={tint}
        experimentalBlurMethod="dimezisBlurView"
        style={StyleSheet.absoluteFill}
      />
      {bordered && (
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.border, { borderRadius: radius }]} />
      )}
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  border: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.55)',
    borderTopColor: 'rgba(255,255,255,0.8)',
  },
})
