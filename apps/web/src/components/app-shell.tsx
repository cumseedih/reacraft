'use client'
import { useCallback, useEffect } from 'react'
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

  // Redirect to login when there is no session token.
  useEffect(() => {
    if (!token) {
      router.replace('/login')
    }
  }, [token, router])

  // Load conversation list from the backend on mount.
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
