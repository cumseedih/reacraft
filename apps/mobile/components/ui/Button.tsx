import {
  ActivityIndicator, Pressable, StyleSheet, Text,
  type PressableProps, type ViewStyle,
} from 'react-native'
import { colors, radii, typography } from '../../theme/tokens'

type Variant = 'primary' | 'secondary' | 'link'

interface ButtonProps extends Omit<PressableProps, 'style'> {
  title: string
  variant?: Variant
  loading?: boolean
  style?: ViewStyle
}

export function Button({
  title, variant = 'primary', loading = false, disabled, style, ...rest
}: ButtonProps) {
  const isDisabled = disabled || loading

  return (
    <Pressable
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        variant === 'primary' && styles.primary,
        variant === 'secondary' && styles.secondary,
        variant === 'link' && styles.link,
        pressed && !isDisabled && styles.pressed,
        isDisabled && styles.disabled,
        style,
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? colors.primaryForeground : colors.primary} />
      ) : (
        <Text
          style={[
            styles.label,
            variant === 'primary' && { color: colors.primaryForeground },
            variant === 'secondary' && { color: colors.primary },
            variant === 'link' && { color: colors.link },
          ]}
        >
          {title}
        </Text>
      )}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  base: {
    minHeight: 44, // guaranteed touch target
    borderRadius: radii.full, // pill
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 21,
    paddingVertical: 11,
    flexDirection: 'row',
  },
  primary: { backgroundColor: colors.primary },
  secondary: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.primary },
  link: { backgroundColor: 'transparent', minHeight: undefined, paddingVertical: 4, paddingHorizontal: 0 },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.5 },
  label: { ...typography.labelLg },
})
