import React, { createContext, useContext, useRef, useCallback, useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Animated, Dimensions, TouchableWithoutFeedback,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { tokens } from '../theme/tokens'
import { useAuthStore } from '../store/auth'

const DRAWER_WIDTH = 300
const { width: SCREEN_WIDTH } = Dimensions.get('window')

// ── Context ─────────────────────────────────────────────────────────────────

interface DrawerContextValue {
  open: () => void
  close: () => void
}

const DrawerContext = createContext<DrawerContextValue>({ open: () => {}, close: () => {} })

export function useDrawer() {
  return useContext(DrawerContext)
}

// ── Types ────────────────────────────────────────────────────────────────────

interface Conversation {
  id: string
  title: string
  updatedAt?: string
}

interface SidebarDrawerProps {
  children: React.ReactNode
  conversations?: Conversation[]
  onNewConversation?: () => void
}

// ── Icons (inline SVG-equivalent via RN primitives) ──────────────────────────

function ZapIcon() {
  return (
    <View style={styles.iconBox}>
      <Text style={styles.iconText}>⚡</Text>
    </View>
  )
}
function PuzzleIcon() {
  return <View style={styles.iconBox}><Text style={styles.iconText}>🧩</Text></View>
}
function FolderIcon() {
  return <View style={styles.iconBox}><Text style={styles.iconText}>📁</Text></View>
}
function BotIcon() {
  return <View style={styles.iconBox}><Text style={styles.iconText}>🤖</Text></View>
}

const NAV_ITEMS = [
  { route: '/projects' as const,    label: 'Automations', Icon: ZapIcon },
  { route: '/projects' as const,    label: 'Plugins',     Icon: PuzzleIcon },
  { route: '/projects' as const,    label: 'Projects',    Icon: FolderIcon },
  { route: '/chat' as const,        label: 'Kroex Bot',   Icon: BotIcon },
] as const

// ── Component ────────────────────────────────────────────────────────────────

export function SidebarDrawer({
  children,
  conversations = [],
  onNewConversation,
}: SidebarDrawerProps) {
  const { user } = useAuthStore()
  const username = user?.name ?? user?.email ?? 'User'
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const translateX = useRef(new Animated.Value(-DRAWER_WIDTH)).current
  const [visible, setVisible] = useState(false)
  const [search, setSearch] = useState('')

  const open = useCallback(() => {
    setVisible(true)
    Animated.spring(translateX, {
      toValue: 0,
      useNativeDriver: true,
      bounciness: 0,
      speed: 20,
    }).start()
  }, [translateX])

  const close = useCallback(() => {
    Animated.spring(translateX, {
      toValue: -DRAWER_WIDTH,
      useNativeDriver: true,
      bounciness: 0,
      speed: 20,
    }).start(() => setVisible(false))
  }, [translateX])

  const navigate = useCallback((route: string) => {
    close()
    setTimeout(() => router.push(route as never), 200)
  }, [close, router])

  const filtered = conversations.filter(c =>
    c.title.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <DrawerContext.Provider value={{ open, close }}>
      <View style={styles.root}>
        {children}

        {/* Backdrop */}
        {visible && (
          <TouchableWithoutFeedback onPress={close}>
            <Animated.View
              style={[
                StyleSheet.absoluteFillObject,
                styles.backdrop,
                {
                  opacity: translateX.interpolate({
                    inputRange: [-DRAWER_WIDTH, 0],
                    outputRange: [0, 0.4],
                  }),
                },
              ]}
            />
          </TouchableWithoutFeedback>
        )}

        {/* Drawer panel */}
        {visible && (
          <Animated.View
            style={[
              styles.drawer,
              { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 8 },
              { transform: [{ translateX }] },
            ]}
          >
            {/* Profile header */}
            <View style={styles.profileRow}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{username[0]?.toUpperCase()}</Text>
              </View>
              <Text style={styles.username} numberOfLines={1}>{username}</Text>
              <TouchableOpacity onPress={close} style={styles.collapseBtn}>
                <Text style={[styles.collapseBtnText, { color: tokens.colors.primary }]}>{'»'}</Text>
              </TouchableOpacity>
            </View>

            {/* Nav card */}
            <View style={styles.navCard}>
              {NAV_ITEMS.map(({ route, label, Icon }, i) => (
                <React.Fragment key={label}>
                  <TouchableOpacity
                    style={styles.navRow}
                    onPress={() => navigate(route)}
                    activeOpacity={0.7}
                  >
                    <Icon />
                    <Text style={styles.navLabel}>{label}</Text>
                    <Text style={styles.chevron}>›</Text>
                  </TouchableOpacity>
                  {i < NAV_ITEMS.length - 1 && (
                    <View style={styles.separator} />
                  )}
                </React.Fragment>
              ))}
            </View>

            {/* Conversations */}
            <View style={styles.convHeader}>
              <Text style={styles.convTitle}>Conversations</Text>
            </View>

            <ScrollView style={styles.convList} showsVerticalScrollIndicator={false}>
              {filtered.map(c => (
                <TouchableOpacity
                  key={c.id}
                  style={styles.convRow}
                  onPress={() => navigate(`/chat/${c.id}`)}
                  activeOpacity={0.7}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.convRowTitle} numberOfLines={1}>{c.title}</Text>
                    {c.updatedAt && (
                      <Text style={styles.convRowDate}>{formatDate(c.updatedAt)}</Text>
                    )}
                  </View>
                  <Text style={styles.moreBtn}>⋮</Text>
                </TouchableOpacity>
              ))}
              {filtered.length === 0 && (
                <Text style={styles.empty}>No conversations yet</Text>
              )}
            </ScrollView>

            {/* Bottom bar */}
            <View style={[styles.bottomBar, { borderTopColor: tokens.colors.border }]}>
              <View style={styles.searchBox}>
                <Text style={styles.searchIcon}>🔍</Text>
                <Text style={styles.searchPlaceholder}>Search</Text>
              </View>
              <TouchableOpacity
                style={styles.iconBtn}
                onPress={() => navigate('/settings')}
              >
                <Text style={styles.bottomIcon}>⚙️</Text>
              </TouchableOpacity>
              {onNewConversation && (
                <TouchableOpacity style={styles.iconBtn} onPress={() => { close(); onNewConversation() }}>
                  <Text style={styles.bottomIcon}>✏️</Text>
                </TouchableOpacity>
              )}
            </View>
          </Animated.View>
        )}
      </View>
    </DrawerContext.Provider>
  )
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  if (days < 7) return d.toLocaleDateString([], { weekday: 'long' })
  return d.toLocaleDateString([], { day: 'numeric', month: 'short' })
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  backdrop: {
    backgroundColor: '#000',
    zIndex: 10,
  },
  drawer: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: DRAWER_WIDTH,
    backgroundColor: '#FFFFFF',
    zIndex: 20,
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 16,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 10,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F5F5F7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1D1D1F',
  },
  username: {
    flex: 1,
    fontSize: 17,
    color: '#1D1D1F',
  },
  collapseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: tokens.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  collapseBtnText: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: -1,
  },
  navCard: {
    marginHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    marginBottom: 12,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    paddingHorizontal: 16,
    gap: 12,
    backgroundColor: '#FFFFFF',
  },
  iconBox: {
    width: 24,
    alignItems: 'center',
  },
  iconText: {
    fontSize: 16,
  },
  navLabel: {
    flex: 1,
    fontSize: 15.6,
    color: '#1D1D1F',
  },
  chevron: {
    fontSize: 18,
    color: '#6B7280',
  },
  separator: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginLeft: 52,
  },
  convHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  convTitle: {
    flex: 1,
    fontSize: 19.5,
    fontWeight: '600',
    color: '#1D1D1F',
    letterSpacing: -0.1,
  },
  convList: {
    flex: 1,
    paddingHorizontal: 8,
  },
  convRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRadius: 12,
    gap: 8,
  },
  convRowTitle: {
    fontSize: 15,
    color: '#1D1D1F',
    lineHeight: 20,
  },
  convRowDate: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 16,
  },
  moreBtn: {
    fontSize: 18,
    color: '#6B7280',
    paddingHorizontal: 4,
  },
  empty: {
    textAlign: 'center',
    marginTop: 40,
    color: '#6B7280',
    fontSize: 14,
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 10,
    gap: 8,
    borderTopWidth: 1,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F7',
    borderRadius: 20,
    paddingHorizontal: 12,
    height: 36,
    gap: 6,
  },
  searchIcon: {
    fontSize: 13,
  },
  searchPlaceholder: {
    fontSize: 14,
    color: '#6B7280',
  },
  iconBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
  },
  bottomIcon: {
    fontSize: 20,
  },
})
