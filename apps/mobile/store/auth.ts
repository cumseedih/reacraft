import { create } from 'zustand'
import * as SecureStore from 'expo-secure-store'

interface User {
  id: string
  name: string
  email: string
  avatar?: string
  plan: string
}

interface AuthState {
  user: User | null
  token: string | null
  setUser: (user: User) => void
  setToken: (token: string) => Promise<void>
  logout: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  setUser: (user) => set({ user }),
  setToken: async (token) => {
    await SecureStore.setItemAsync('kroex_token', token)
    set({ token })
  },
  logout: async () => {
    await SecureStore.deleteItemAsync('kroex_token')
    set({ user: null, token: null })
  },
}))
