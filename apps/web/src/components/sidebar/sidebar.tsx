'use client'
import { useState, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus, Search, MessageSquare, FolderOpen, Settings, ChevronLeft,
  ChevronRight, Archive, Pin, Trash2, Edit2, MoreHorizontal,
  Zap, User, LogOut, Moon, Sun, Monitor, ChevronDown, Star,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { WithTooltip } from '@/components/ui/tooltip'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuLabel,
} from '@/components/ui/dropdown-menu'
import { useChatStore } from '@/store/chat'
import { useAuthStore } from '@/store/auth'
import { useSettingsStore } from '@/store/settings'
import { cn, truncate, formatDate } from '@/lib/utils'
import type { Conversation, Project } from '@/types'

interface SidebarProps {
  projects: Project[]
  onNewConversation: () => void
}

export function Sidebar({ projects, onNewConversation }: SidebarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { conversations, activeConversationId, setActiveConversation } = useChatStore()
  const { user, logout } = useAuthStore()
  const { sidebarCollapsed, theme, update } = useSettingsStore()
  const [search, setSearch] = useState('')
  const [showProjects, setShowProjects] = useState(true)

  const filtered = conversations.filter(c =>
    !c.archived && c.title.toLowerCase().includes(search.toLowerCase())
  )
  const pinned = filtered.filter(c => c.pinned)
  const recent = filtered.filter(c => !c.pinned)

  if (sidebarCollapsed) {
    return (
      <div className="flex flex-col items-center py-4 px-2 h-full bg-secondary/30 border-r border-border w-14 gap-2">
        <WithTooltip tip="KROEX" side="right">
          <Link href="/chat">
            <Image src="/assets/kroex-raven.png" alt="KROEX" width={32} height={32} className="rounded-lg object-cover" />
          </Link>
        </WithTooltip>
        <Separator className="w-8 my-1" />
        <WithTooltip tip="New chat" side="right">
          <Button size="icon-sm" variant="ghost" onClick={onNewConversation}><Plus className="h-4 w-4"/></Button>
        </WithTooltip>
        <WithTooltip tip="Search" side="right">
          <Button size="icon-sm" variant="ghost"><Search className="h-4 w-4"/></Button>
        </WithTooltip>
        <WithTooltip tip="Projects" side="right">
          <Button size="icon-sm" variant="ghost"><FolderOpen className="h-4 w-4"/></Button>
        </WithTooltip>
        <div className="flex-1" />
        <WithTooltip tip="Settings" side="right">
          <Button size="icon-sm" variant="ghost" onClick={() => router.push('/settings')}>
            <Settings className="h-4 w-4"/>
          </Button>
        </WithTooltip>
        <Button size="icon-sm" variant="ghost" onClick={() => update({ sidebarCollapsed: false })}>
          <ChevronRight className="h-4 w-4"/>
        </Button>
      </div>
    )
  }

  return (
    <motion.div
      initial={false}
      className="sidebar flex flex-col h-full"
      style={{ width: 'var(--sidebar-width)' }}
    >
      <div className="flex items-center justify-between p-3 pb-2">
        <Link href="/chat" className="flex items-center gap-2 group">
          <Image
            src="/assets/kroex-raven.png"
            alt="KROEX"
            width={28}
            height={28}
            className="rounded-lg object-cover"
          />
          <span className="font-semibold text-sm tracking-wide text-foreground">KROEX</span>
        </Link>
        <Button
          size="icon-sm"
          variant="ghost"
          onClick={() => update({ sidebarCollapsed: true })}
          className="opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <ChevronLeft className="h-4 w-4"/>
        </Button>
      </div>

      <div className="px-3 pb-2">
        <Button
          className="w-full justify-start gap-2 text-sm"
          variant="outline"
          size="sm"
          onClick={onNewConversation}
        >
          <Plus className="h-4 w-4" />
          New conversation
        </Button>
      </div>

      <div className="px-3 pb-2">
        <Input
          placeholder="Search conversations…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          startIcon={<Search className="h-3.5 w-3.5" />}
          className="h-8 text-sm bg-muted/50"
        />
      </div>

      <ScrollArea className="flex-1 px-2">
        {projects.length > 0 && (
          <div className="mb-2">
            <button
              onClick={() => setShowProjects(v => !v)}
              className="flex items-center gap-1.5 w-full px-2 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-muted/50"
            >
              <ChevronDown className={cn('h-3 w-3 transition-transform', !showProjects && '-rotate-90')} />
              Projects
            </button>
            <AnimatePresence>
              {showProjects && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="overflow-hidden"
                >
                  {projects.map(p => (
                    <SidebarProject key={p.id} project={p} active={pathname.includes(`/projects/${p.id}`)} />
                  ))}
                  <Link
                    href="/projects/new"
                    className="flex items-center gap-2 px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    New project
                  </Link>
                </motion.div>
              )}
            </AnimatePresence>
            <Separator className="mt-2 mb-1" />
          </div>
        )}

        {pinned.length > 0 && (
          <div className="mb-1">
            <p className="px-2 py-1 text-xs font-semibold text-muted-foreground">Pinned</p>
            {pinned.map(c => (
              <ConversationItem key={c.id} conversation={c} active={c.id === activeConversationId} />
            ))}
          </div>
        )}

        {recent.length > 0 && (
          <div>
            {pinned.length > 0 && <p className="px-2 py-1 text-xs font-semibold text-muted-foreground mt-1">Recent</p>}
            {recent.slice(0, 50).map(c => (
              <ConversationItem key={c.id} conversation={c} active={c.id === activeConversationId} />
            ))}
          </div>
        )}

        {filtered.length === 0 && search && (
          <div className="text-center py-8 text-muted-foreground text-sm">
            No results for &ldquo;{search}&rdquo;
          </div>
        )}
      </ScrollArea>

      <div className="p-2 border-t border-border mt-auto">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2.5 w-full rounded-xl px-2 py-2 hover:bg-secondary transition-colors text-left">
              <Avatar className="h-7 w-7 shrink-0">
                <AvatarImage src={user?.avatar} />
                <AvatarFallback className="text-xs bg-primary/10 text-primary">
                  {user?.name?.[0]?.toUpperCase() ?? 'K'}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{user?.name ?? 'User'}</p>
                <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
              </div>
              <MoreHorizontal className="h-4 w-4 text-muted-foreground shrink-0" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <div>
                <p className="text-sm font-medium">{user?.name}</p>
                <p className="text-xs text-muted-foreground">{user?.email}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push('/settings/profile')}>
              <User className="mr-2 h-4 w-4" /> Profile
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push('/settings')}>
              <Settings className="mr-2 h-4 w-4" /> Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => update({ theme: theme === 'dark' ? 'light' : 'dark' })}>
              {theme === 'dark' ? <Sun className="mr-2 h-4 w-4" /> : <Moon className="mr-2 h-4 w-4" />}
              {theme === 'dark' ? 'Light mode' : 'Dark mode'}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem destructive onClick={logout}>
              <LogOut className="mr-2 h-4 w-4" /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </motion.div>
  )
}

function ConversationItem({ conversation: c, active }: { conversation: Conversation; active: boolean }) {
  const router = useRouter()
  const { setActiveConversation, updateConversation, removeConversation } = useChatStore()
  const [hovered, setHovered] = useState(false)

  return (
    <div
      className={cn(
        'group flex items-center gap-2 rounded-xl px-2 py-1.5 cursor-pointer transition-all duration-100 text-sm',
        active ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
      )}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => { setActiveConversation(c.id); router.push(`/chat/${c.id}`) }}
    >
      <MessageSquare className="h-3.5 w-3.5 shrink-0 opacity-60" />
      <span className="flex-1 truncate">{truncate(c.title, 30)}</span>
      <AnimatePresence>
        {hovered && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-0.5"
            onClick={e => e.stopPropagation()}
          >
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="icon-sm" variant="ghost" className="h-6 w-6 opacity-70 hover:opacity-100">
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => updateConversation(c.id, { pinned: !c.pinned })}>
                  <Pin className="mr-2 h-4 w-4" /> {c.pinned ? 'Unpin' : 'Pin'}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => updateConversation(c.id, { archived: true })}>
                  <Archive className="mr-2 h-4 w-4" /> Archive
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem destructive onClick={() => removeConversation(c.id)}>
                  <Trash2 className="mr-2 h-4 w-4" /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function SidebarProject({ project: p, active }: { project: Project; active: boolean }) {
  const router = useRouter()
  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-xl px-2 py-1.5 cursor-pointer transition-colors text-sm',
        active ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
      )}
      onClick={() => router.push(`/projects/${p.id}`)}
    >
      <FolderOpen className="h-3.5 w-3.5 shrink-0 opacity-60" />
      <span className="flex-1 truncate">{truncate(p.name, 28)}</span>
    </div>
  )
}
