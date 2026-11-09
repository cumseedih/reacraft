import { TextInput, StyleSheet, type TextInputProps } from 'react-native'
import { colors, radii, typography } from '../../theme/tokens'

interface InputProps extends TextInputProps {
  invalid?: boolean
}

export function Input({ invalid, style, ...rest }: InputProps) {
  return (
    <TextInput
      placeholderTextColor={colors.mutedForeground}
      style={[styles.input, invalid && styles.invalid, style]}
      {...rest}
    />
  )
}

const styles = StyleSheet.create({
  input: {
    minHeight: 50,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: 14,
    paddingVertical: 11,
    color: colors.onSurface,
    ...typography.bodyMd,
  },
  invalid: { borderColor: colors.error },
})
