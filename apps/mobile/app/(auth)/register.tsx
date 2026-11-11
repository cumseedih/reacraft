import { useState } from 'react'
import {
  View, Text, StyleSheet, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { useAuthStore } from '../../store/auth'
import { getClient } from '../../lib/client'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { colors, spacing, typography } from '../../theme/tokens'

export default function RegisterScreen() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { setToken, setUser } = useAuthStore()

  const handleRegister = async () => {
    if (!name.trim() || !email.trim() || !password) return
    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await getClient().auth.register({ name: name.trim(), email: email.trim(), password })
      await setToken(res.token)
      setUser(res.user)
      router.replace('/(app)/chat')
    } catch (e: any) {
      setError(e?.message ?? 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  const canSubmit = !!name.trim() && !!email.trim() && !!password

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.inner}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Text style={styles.logo}>KROEX</Text>
            <Text style={styles.tagline}>Create your account</Text>
          </View>

          <View style={styles.form}>
            <Text style={styles.title}>Get started</Text>
            <Text style={styles.subtitle}>Start thinking deeper with KROEX</Text>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <View style={styles.field}>
              <Text style={styles.label}>Full name</Text>
              <Input
                value={name}
                onChangeText={setName}
                placeholder="Your name"
                autoCapitalize="words"
                autoCorrect={false}
                returnKeyType="next"
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Email</Text>
              <Input
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                returnKeyType="next"
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Password</Text>
              <Input
                value={password}
                onChangeText={setPassword}
                placeholder="Min. 8 characters"
                secureTextEntry
                autoComplete="password-new"
                returnKeyType="go"
                onSubmitEditing={handleRegister}
              />
            </View>

            <Button
              title="Create account"
              onPress={handleRegister}
              loading={loading}
              disabled={!canSubmit}
              style={{ marginTop: spacing.xs }}
            />

            <View style={styles.footer}>
              <Text style={styles.footerText}>Already have an account? </Text>
              <Button title="Sign in" variant="link" onPress={() => router.back()} />
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  inner: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.md },
  header: { alignItems: 'center', marginBottom: spacing.md },
  logo: { ...typography.headlineSm, color: colors.onSurface, fontWeight: '700', letterSpacing: 1 },
  tagline: { ...typography.bodySm, color: colors.mutedForeground, marginTop: spacing.xs },
  form: { gap: spacing.sm },
  title: { ...typography.headlineSm, color: colors.onSurface },
  subtitle: { ...typography.bodySm, color: colors.mutedForeground, marginTop: -spacing.xs, marginBottom: spacing.xs },
  field: { gap: 6 },
  label: { ...typography.labelMd, color: colors.onSurface },
  error: { ...typography.bodySm, color: colors.error },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: spacing.xs },
  footerText: { ...typography.bodySm, color: colors.mutedForeground },
})
