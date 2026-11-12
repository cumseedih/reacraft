import { useState } from 'react'
import {
  View, Text, StyleSheet, KeyboardAvoidingView, Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { useAuthStore } from '../../store/auth'
import { getClient } from '../../lib/client'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { colors, spacing, typography } from '../../theme/tokens'

export default function LoginScreen() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { setToken, setUser } = useAuthStore()

  const handleLogin = async () => {
    if (!email.trim() || !password) return
    setLoading(true)
    setError('')
    try {
      const res = await getClient().auth.login({ email: email.trim(), password })
      await setToken(res.token)
      setUser(res.user)
      router.replace('/(app)/chat')
    } catch (e: any) {
      setError(e?.message ?? 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.inner}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.header}>
          <Text style={styles.logo}>KROEX</Text>
          <Text style={styles.tagline}>Think deeper. Build further.</Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.title}>Welcome back</Text>
          <Text style={styles.subtitle}>Sign in to your KROEX account</Text>

          {error ? <Text style={styles.error}>{error}</Text> : null}

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
              placeholder="Your password"
              secureTextEntry
              autoComplete="current-password"
              returnKeyType="go"
              onSubmitEditing={handleLogin}
            />
          </View>

          <Button
            title="Sign in"
            onPress={handleLogin}
            loading={loading}
            disabled={!email.trim() || !password}
            style={{ marginTop: spacing.xs }}
          />

          <View style={styles.footer}>
            <Text style={styles.footerText}>New to KROEX? </Text>
            <Button title="Create an account" variant="link" onPress={() => router.push('/(auth)/register')} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  inner: { flex: 1, justifyContent: 'center', paddingHorizontal: spacing.md },
  header: { alignItems: 'center', marginBottom: spacing.lg },
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
