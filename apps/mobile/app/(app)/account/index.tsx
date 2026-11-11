import { useState } from 'react'
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import type { KroexModelId } from '@kroex/api'
import { useAuthStore } from '../../../store/auth'
import { useSettingsStore } from '../../../store/settings'
import { MOBILE_MODELS } from '../../../lib/models'
import { confirmDestructive } from '../../../lib/confirm'
import { ScreenHeader } from '../../../components/ui/ScreenHeader'
import { Card } from '../../../components/ui/Card'
import { Button } from '../../../components/ui/Button'
import { Badge } from '../../../components/ui/Badge'
import { ModelSelector } from '../../../components/ModelSelector'
import { colors, spacing, typography } from '../../../theme/tokens'

export default function AccountScreen() {
  const { user, logout } = useAuthStore()
  const { defaultModel, setDefaultModel } = useSettingsStore()
  const [pickerOpen, setPickerOpen] = useState(false)

  const current = MOBILE_MODELS.find((m) => m.id === defaultModel)

  const handleLogout = async () => {
    const ok = await confirmDestructive({
      title: 'Sign out',
      message: 'Sign out of KROEX on this device?',
      confirmLabel: 'Sign out',
    })
    if (!ok) return
    await logout()
    router.replace('/(auth)/login')
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader title="Account" />
      <ScrollView contentContainerStyle={styles.body}>
        <Card style={styles.profile}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{(user?.name || user?.email || '?').slice(0, 1).toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{user?.name || 'KROEX user'}</Text>
            <Text style={styles.email}>{user?.email}</Text>
          </View>
          {user?.plan ? <Badge label={user.plan} variant="default" /> : null}
        </Card>

        <Text style={styles.sectionLabel}>Preferences</Text>
        <Card>
          <Pressable style={styles.settingRow} onPress={() => setPickerOpen(true)}>
            <View style={styles.settingLeft}>
              <Ionicons name="sparkles-outline" size={20} color={colors.primary} />
              <View>
                <Text style={styles.settingTitle}>Default model</Text>
                <Text style={styles.settingValue}>{current?.name ?? defaultModel}</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
          </Pressable>
        </Card>

        <Text style={styles.sectionLabel}>Session</Text>
        <Card>
          <Text style={styles.note}>
            Your session uses a 7-day token stored securely on this device. There is no server-side
            logout — signing out clears the token locally.
          </Text>
          <Button title="Sign out" variant="secondary" onPress={handleLogout} style={{ marginTop: spacing.sm }} />
        </Card>

        <Text style={styles.version}>KROEX Mobile 1.0.0</Text>
      </ScrollView>

      <ModelSelector
        visible={pickerOpen}
        selectedModel={defaultModel}
        onSelect={(id) => setDefaultModel(id as KroexModelId)}
        onClose={() => setPickerOpen(false)}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  body: { padding: spacing.sm, gap: 10 },
  profile: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  avatarText: { ...typography.labelLg, color: colors.primaryForeground, fontWeight: '700' },
  name: { ...typography.labelLg, color: colors.onSurface },
  email: { ...typography.bodySm, color: colors.mutedForeground, marginTop: 2 },
  sectionLabel: { ...typography.labelMd, color: colors.mutedForeground, marginTop: 8, marginLeft: 4 },
  settingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  settingLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  settingTitle: { ...typography.labelMd, color: colors.onSurface },
  settingValue: { ...typography.labelSm, color: colors.mutedForeground, marginTop: 2 },
  note: { ...typography.bodySm, color: colors.mutedForeground },
  version: { ...typography.labelSm, color: colors.mutedForeground, textAlign: 'center', marginTop: spacing.md },
})
