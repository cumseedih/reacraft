import { Stack } from 'expo-router'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StatusBar } from 'expo-status-bar'
import { useColorScheme } from 'react-native'

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 60_000 } },
})

export default function RootLayout() {
  const colorScheme = useColorScheme()

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(app)" />
        </Stack>
      </QueryClientProvider>
    </GestureHandlerRootView>
  )
}
