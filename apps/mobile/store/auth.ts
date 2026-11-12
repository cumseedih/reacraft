import { create } from 'zustand'
import * as SecureStore from 'expo-secure-store'
import type { UserOut } from '@kroex/api'

// The session user is exactly the backend's UserOut shape (avatar is
// string | null per the API contract), sourced from the shared package so
// the store and the typed client never drift.
type User = UserOut

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
