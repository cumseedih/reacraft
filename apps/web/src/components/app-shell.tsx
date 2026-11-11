'use client'
import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Sidebar } from '@/components/sidebar/sidebar'
import { useChatStore } from '@/store/chat'
import { useAuthStore } from '@/store/auth'
import { get } from '@/lib/api'
import type { Conversation, Project } from '@/types'

interface AppShellProps {
  children: React.ReactNode
  projects?: Project[]
}

// Backend returns snake_case; map to frontend camelCase Conversation type.
function mapConversation(raw: Record<string, unknown>): Conversation {
  return {
    id: raw.id as string,
    title: raw.title as string,
    model: raw.model as string,
    createdAt: raw.created_at as string,
    updatedAt: raw.updated_at as string,
    pinned: false,
    archived: false,
  }
}

export function AppShell({ children, projects = [] }: AppShellProps) {
  const router = useRouter()
  const { setConversations } = useChatStore()
  const { token } = useAuthStore()

  // The auth store is persisted to localStorage and rehydrates on the client
  // after the first render. Track hydration so we don't bounce an authenticated
  // user to /login on a hard refresh before the token has been restored.
  // (persist API is unavailable during server prerender, so access it safely.)
  const [hydrated, setHydrated] = useState(() => useAuthStore.persist?.hasHydrated?.() === true)
  useEffect(() => {
    if (useAuthStore.persist?.hasHydrated?.() === true) {
      setHydrated(true)
      return
    }
    const unsub = useAuthStore.persist?.onFinishHydration?.(() => setHydrated(true))
    if (!unsub) {
      // persist API genuinely unavailable: unblock rendering rather than hang,
      // but the redirect below still checks persisted storage before acting.
      setHydrated(true)
    }
    return unsub
  }, [])

  // Redirect to login only once hydration has settled AND no session exists.
  // The localStorage check is deliberate belt-and-braces: `hydrated` alone is
  // not sufficient, because a momentarily-unavailable persist API would mark
  // hydration "done" while the store's token is still null, bouncing an
  // authenticated user to /login on hard refresh. setToken()/logout() keep
  // this key in lockstep with the store, so it is a safe second opinion.
  useEffect(() => {
    if (!hydrated || token) return
    const persistedToken =
      typeof window !== 'undefined' ? window.localStorage.getItem('kroex_token') : null
    if (persistedToken) return
    router.replace('/login')
  }, [hydrated, token, router])

  // Load conversation list from the backend once authenticated.
  useEffect(() => {
    if (!token) return
    get<Record<string, unknown>[]>('/api/conversations')
      .then(raw => setConversations(raw.map(mapConversation)))
      .catch(() => {
        // 401 is handled by the axios interceptor (redirects to /login).
      })
  }, [token, setConversations])

  const handleNewConversation = useCallback(() => {
    router.push('/chat')
  }, [router])

  if (!hydrated) return null
  if (!token) return null

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar projects={projects} onNewConversation={handleNewConversation} />
      <main className="flex-1 overflow-hidden">
        {children}
      </main>
    </div>
  )
}
