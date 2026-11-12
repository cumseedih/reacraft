import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User } from '@/types'

interface AuthState {
  user: User | null
  token: string | null
  isLoading: boolean
  setUser: (user: User | null) => void
  setToken: (token: string | null) => void
  setLoading: (loading: boolean) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isLoading: false,
      setUser: (user) => set({ user }),
      setToken: (token) => {
        set({ token })
        if (typeof window !== 'undefined') {
          if (token) localStorage.setItem('kroex_token', token)
          else localStorage.removeItem('kroex_token')
        }
      },
      setLoading: (isLoading) => set({ isLoading }),
      logout: () => {
        set({ user: null, token: null })
        if (typeof window !== 'undefined') localStorage.removeItem('kroex_token')
      },
    }),
    { name: 'kroex-auth', partialize: (s) => ({ user: s.user, token: s.token }) }
  )
)
