import { View, Text, StyleSheet, ScrollView } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { ScreenHeader } from '../../../components/ui/ScreenHeader'
import { Card } from '../../../components/ui/Card'
import { colors, spacing, typography } from '../../../theme/tokens'

interface ToolEntry {
  icon: keyof typeof Ionicons.glyphMap
  title: string
  subtitle: string
  href: string
}

const TOOLS: ToolEntry[] = [
  { icon: 'hardware-chip-outline', title: 'KROEX BOT', subtitle: 'Chat that proposes actions you confirm', href: '/(app)/tools/bot' },
  { icon: 'git-network-outline', title: 'Agents', subtitle: 'Create agents, launch runs and review patches', href: '/(app)/tools/agents' },
  { icon: 'cube-outline', title: 'Sandbox', subtitle: 'Isolated sessions and command execution', href: '/(app)/tools/sandbox' },
  { icon: 'documents-outline', title: 'Artifacts', subtitle: 'Code and documents produced in chat', href: '/(app)/tools/artifacts' },
]

export default function ToolsHubScreen() {
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader title="Tools" />
      <ScrollView contentContainerStyle={styles.list}>
        {TOOLS.map((t) => (
          <Card key={t.href} onPress={() => router.push(t.href as never)} style={styles.card}>
            <View style={styles.row}>
              <View style={styles.iconWrap}>
                <Ionicons name={t.icon} size={22} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>{t.title}</Text>
                <Text style={styles.subtitle}>{t.subtitle}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
            </View>
          </Card>
        ))}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  list: { padding: spacing.sm, gap: 10 },
  card: {},
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconWrap: { width: 40, height: 40, borderRadius: 10, backgroundColor: 'rgba(0,113,227,0.08)', alignItems: 'center', justifyContent: 'center' },
  title: { ...typography.labelMd, color: colors.onSurface },
  subtitle: { ...typography.bodySm, color: colors.mutedForeground, marginTop: 2 },
})
