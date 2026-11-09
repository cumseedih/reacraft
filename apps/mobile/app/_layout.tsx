import { useEffect, useState } from 'react'
import { Stack } from 'expo-router'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StatusBar } from 'expo-status-bar'
import { useColorScheme } from 'react-native'
import * as SecureStore from 'expo-secure-store'
import { useAuthStore } from '../store/auth'
import { api } from '../lib/api'

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 60_000 } },
})

function AuthInitializer({ children }: { children: React.ReactNode }) {
  const { setToken, setUser, token } = useAuthStore()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    // On first launch, restore token from SecureStore and verify it is still valid.
    async function init() {
      try {
        const stored = await SecureStore.getItemAsync('kroex_token')
        if (stored) {
          await setToken(stored)
          // Validate the stored token by fetching the current user.
          const me = await api.get<any>('/api/auth/me')
          setUser(me)
        }
      } catch {
        // Token is expired or invalid — clear it so the router redirects to login.
        await SecureStore.deleteItemAsync('kroex_token')
        useAuthStore.setState({ token: null, user: null })
      } finally {
        setReady(true)
      }
    }
    if (!token) {
      init()
    } else {
      setReady(true)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!ready) return null
  return <>{children}</>
}

export default function RootLayout() {
  const colorScheme = useColorScheme()

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
        <AuthInitializer>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(app)" />
          </Stack>
        </AuthInitializer>
      </QueryClientProvider>
    </GestureHandlerRootView>
  )
}
