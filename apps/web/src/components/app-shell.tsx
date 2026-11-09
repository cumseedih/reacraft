'use client'
import { useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Sidebar } from '@/components/sidebar/sidebar'
import { useChatStore } from '@/store/chat'
import { useAuthStore } from '@/store/auth'
import { generateId } from '@/lib/utils'
import type { Project } from '@/types'

interface AppShellProps {
  children: React.ReactNode
  projects?: Project[]
}

export function AppShell({ children, projects = [] }: AppShellProps) {
  const router = useRouter()
  const { addConversation } = useChatStore()
  const { user } = useAuthStore()

  const handleNewConversation = useCallback(() => {
    const id = generateId()
    addConversation({
      id,
      title: 'New conversation',
      model: 'kroex-pro',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      pinned: false,
      archived: false,
    })
    router.push(`/chat/${id}`)
  }, [addConversation, router])

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar projects={projects} onNewConversation={handleNewConversation} />
      <main className="flex-1 overflow-hidden">
        {children}
      </main>
    </div>
  )
}
