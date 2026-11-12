import { Pressable, View, StyleSheet, type ViewProps } from 'react-native'
import { colors, radii } from '../../theme/tokens'

interface CardProps extends ViewProps {
  onPress?: () => void
}

/** A bordered surface card; pressable when onPress is supplied. */
export function Card({ children, style, onPress, ...rest }: CardProps) {
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.card, pressed && styles.pressed, style]}
      >
        {children}
      </Pressable>
    )
  }
  return (
    <View style={[styles.card, style]} {...rest}>
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radii.lg,
    padding: 14,
  },
  pressed: { opacity: 0.7 },
})
