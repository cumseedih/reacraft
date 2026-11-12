
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import {
  LogOut,
  Pin,
  Archive,
  Trash2,
  Settings,
} from 'lucide-react'

import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

import { useChatStore } from '@/store/chat'
import { useAuthStore } from '@/store/auth'
import { useSettingsStore } from '@/store/settings'
import { cn, truncate } from '@/lib/utils'
import type { Conversation, Project } from '@/types'

// Apple Light design tokens
const AL = {
  primary: '#0071E3',
  secondary: '#2997FF',
  text: '#1D1D1F',
  muted: '#737782',
  border: '#E5E7EB',
  surface: '#FFFFFF',
  bg: '#FFFFFF',
} as const

const ICONS = {
  automations: '/icons/nav/automations.svg',
  plugins: '/icons/nav/plugins.svg',
  projects: '/icons/nav/projects.svg',
  kroexBot: '/icons/nav/kroex-bot.svg',
  chevronRight: '/icons/nav/chevron-right.svg',
  chevronDown: '/icons/nav/chevron-down.svg',
  more: '/icons/nav/more.svg',
  search: '/icons/nav/search.svg',
  settings: '/icons/nav/settings.svg',
  compose: '/icons/nav/compose.svg',
  collapse: '/icons/nav/collapse.svg',
} as const

function Icon({
  src,
  size = 20,
  label = '',
}: {
  src: string
  size?: number
  label?: string
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={label}
      width={size}
      height={size}
      className="shrink-0 select-none"
      aria-hidden={!label}
    />
  )
}

interface SidebarProps {
  projects: Project[]
  onNewConversation: () => void
}

const NAV_ITEMS = [
  {
    href: '/automations',
    label: 'Automations',
    icon: ICONS.automations,
  },
  {
    href: '/plugins',
    label: 'Plugins',
    icon: ICONS.plugins,
  },
  {
    href: '/projects',
    label: 'Projects',
    icon: ICONS.projects,
  },
  {
    href: '/bot',
    label: 'Kroex Bot',
    icon: ICONS.kroexBot,
  },
] as const

export function Sidebar({ onNewConversation }: SidebarProps) {
  const router = useRouter()
  const pathname = usePathname()

  const {
    conversations,
    activeConversationId,
    setActiveConversation,
    updateConversation,
    removeConversation,
  } = useChatStore()

  const { user, logout } = useAuthStore()
  const { sidebarCollapsed, update } = useSettingsStore()

  const [search, setSearch] = useState('')
  const [convExpanded, setConvExpanded] = useState(true)

  const filtered = conversations.filter(
    c =>
      !c.archived &&
      c.title.toLowerCase().includes(search.toLowerCase())
  )

  // Collapsed sidebar
  if (sidebarCollapsed) {
    return (
      <div
        className="flex flex-col items-center py-4 px-2 h-full border-r w-14 gap-3"
        style={{
          background: AL.bg,
          borderColor: AL.border,
        }}
      >
        <button
          onClick={() => update({ sidebarCollapsed: false })}
          className="w-8 h-8 rounded-full flex items-center justify-center transition-colors hover:bg-gray-100"
          style={{ border: `1px solid ${AL.border}` }}
          aria-label="Expand sidebar"
        >
          <Icon src={ICONS.collapse} size={14} label="Expand" />
        </button>

        <button
          onClick={() => router.push('/projects')}
          className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-gray-100 transition-colors"
        >
          <Icon src={ICONS.projects} size={22} />
        </button>

        <button
          onClick={() => router.push('/bot')}
          className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-gray-100 transition-colors"
        >
          <Icon src={ICONS.kroexBot} size={22} />
        </button>

        <div className="flex-1" />

        <button
          onClick={() => router.push('/settings')}
          className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-gray-100 transition-colors"
        >
          <Icon src={ICONS.settings} size={22} />
        </button>
      </div>
    )
  }

  return (
    <div
      className="flex flex-col h-full shrink-0"
      style={{
        width: 'var(--sidebar-width)',
        background: AL.bg,
        borderRight: `1px solid ${AL.border}`,
      }}
    >
      {/* Profile header */}
      <div className="flex items-center gap-3 px-4 pt-5 pb-4">
        <Avatar className="h-10 w-10 shrink-0">
          <AvatarImage src={user?.avatar} />

          <AvatarFallback
            className="text-sm font-medium"
            style={{
              background: '#F5F5F7',
              color: AL.text,
            }}
          >
            {user?.name?.[0]?.toUpperCase() ?? 'K'}
          </AvatarFallback>
        </Avatar>

        <span
          className="flex-1 text-base font-normal truncate"
          style={{
            color: AL.text,
            fontSize: 17,
          }}
        >
          {user?.name ?? 'User'}
        </span>

        <button
          onClick={() => update({ sidebarCollapsed: true })}
          className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-colors hover:opacity-80"
          style={{
            border: `1px solid ${AL.border}`,
            background: AL.surface,
          }}
          aria-label="Collapse sidebar"
        >
          <Icon src={ICONS.collapse} size={14} label="Collapse" />
        </button>
      </div>

      {/* Navigation card */}
      <div className="px-4 pb-4">
        <div
          className="overflow-hidden"
          style={{
            background: AL.surface,
            border: `1px solid ${AL.border}`,
            borderRadius: 20,
          }}
        >
          {NAV_ITEMS.map(({ href, label, icon }, i) => {
            const active = pathname.startsWith(href)

            return (
              <div key={href}>
                <Link
                  href={href}
                  className="flex items-center gap-4 px-5 transition-colors hover:bg-gray-50"
                  style={{
                    height: 72,
                    color: AL.text,
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={icon}
                    alt=""
                    className="w-7 h-7 shrink-0"
                    aria-hidden="true"
                  />

                  <span
                    className="flex-1"
                    style={{
                      fontSize: 17,
                      color: active ? AL.primary : AL.text,
                    }}
                  >
                    {label}
                  </span>

                  <Icon src={ICONS.chevronRight} size={18} />
                </Link>

                {i < NAV_ITEMS.length - 1 && (
                  <div
                    style={{
                      height: 1,
                      background: AL.border,
                      marginLeft: 56,
                    }}
                  />
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Conversations heading */}
      <div className="flex items-center justify-between px-4 py-3">
        <span
          className="font-normal"
          style={{
            fontSize: 25,
            color: AL.text,
            letterSpacing: -0.4,
          }}
        >
          Conversations
        </span>

        <button
          onClick={() => setConvExpanded(v => !v)}
          className="p-1 rounded-lg hover:bg-gray-100 transition-colors"
          style={{
            transform: convExpanded
              ? 'rotate(0deg)'
              : 'rotate(-90deg)',
            transition: 'transform .2s',
          }}
          aria-label="Toggle conversations"
        >
          <Icon src={ICONS.chevronDown} size={20} />
        </button>
      </div>

      {/* Conversation list */}
      {convExpanded && (
        <ScrollArea className="flex-1 px-2">
          {filtered.map(c => (
            <ConversationRow
              key={c.id}
              conversation={c}
              active={c.id === activeConversationId}
              onSelect={() => {
                setActiveConversation(c.id)
                router.push(`/chat/${c.id}`)
              }}
              onPin={() =>
                updateConversation(c.id, {
                  pinned: !c.pinned,
                })
              }
              onArchive={() =>
                updateConversation(c.id, {
                  archived: true,
                })
              }
              onDelete={() => removeConversation(c.id)}
            />
          ))}

          {filtered.length === 0 && !search && (
            <div
              className="text-center py-10"
              style={{
                color: AL.muted,
                fontSize: 14,
              }}
            >
              No conversations yet
            </div>
          )}

          {filtered.length === 0 && search && (
            <div
              className="text-center py-10"
              style={{
                color: AL.muted,
                fontSize: 14,
              }}
            >
              No results for &ldquo;{search}&rdquo;
            </div>
          )}
        </ScrollArea>
      )}

      {!convExpanded && <div className="flex-1" />}

      {/* Bottom controls */}
      <div
        className="flex items-center gap-2 px-3 py-4"
        style={{
          borderTop: `1px solid ${AL.border}`,
        }}
      >
        {/* Search */}
        <div className="relative flex-1 min-w-0">
          <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
            <Icon src={ICONS.search} size={20} />
          </div>

          <input
            type="text"
            placeholder="Search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-11 pr-4 h-14 text-base rounded-full outline-none"
            style={{
              background: '#F5F5F7',
              color: AL.text,
              fontSize: 17,
              border: 'none',
            }}
          />
        </div>

        {/* Settings */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="w-11 h-11 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors shrink-0"
              aria-label="Settings"
            >
              <Icon src={ICONS.settings} size={24} />
            </button>
          </DropdownMenuTrigger>

          <DropdownMenuContent
            side="top"
            align="end"
            className="w-48"
          >
            <DropdownMenuItem
              onClick={() => router.push('/settings')}
            >
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem
              onClick={() => router.push('/memory')}
            >
              Memory
            </DropdownMenuItem>

            <DropdownMenuItem
              onClick={() => router.push('/artifacts')}
            >
              Artifacts
            </DropdownMenuItem>

            <DropdownMenuItem
              onClick={() => router.push('/agents')}
            >
              Agents
            </DropdownMenuItem>

            <DropdownMenuItem
              onClick={() => router.push('/sandbox')}
            >
              Sandbox
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem
              className="text-destructive"
              onClick={logout}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* New conversation */}
        <button
          onClick={onNewConversation}
          className="w-11 h-11 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors shrink-0"
          aria-label="New conversation"
        >
          <Icon src={ICONS.compose} size={24} />
        </button>
      </div>
    </div>
  )
}

// Conversation row
interface ConversationRowProps {
  conversation: Conversation
  active: boolean
  onSelect: () => void
  onPin: () => void
  onArchive: () => void
  onDelete: () => void
}

function ConversationRow({
  conversation: c,
  active,
  onSelect,
  onPin,
  onArchive,
  onDelete,
}: ConversationRowProps) {
  const dateLabel = formatDate(c.updatedAt ?? c.createdAt)

  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-xl px-3 py-3 cursor-pointer transition-colors group',
        active ? 'bg-blue-50' : 'hover:bg-gray-50'
      )}
      onClick={onSelect}
    >
      <div className="flex-1 min-w-0">
        <p
          className="truncate"
          style={{
            fontSize: 16,
            color: AL.text,
            lineHeight: '22px',
          }}
        >
          {truncate(c.title, 34)}
        </p>

        <p
          className="text-xs"
          style={{
            color: AL.muted,
            fontSize: 13,
            lineHeight: '18px',
          }}
        >
          {dateLabel}
        </p>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="w-8 h-8 flex items-center justify-center rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-gray-100"
            onClick={e => e.stopPropagation()}
            aria-label="Conversation options"
          >
            <Icon src={ICONS.more} size={18} />
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align="end"
          onClick={e => e.stopPropagation()}
        >
          <DropdownMenuItem onClick={onPin}>
            <Pin className="mr-2 h-4 w-4" />
            {c.pinned ? 'Unpin' : 'Pin'}
          </DropdownMenuItem>

          <DropdownMenuItem onClick={onArchive}>
            <Archive className="mr-2 h-4 w-4" />
            Archive
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem
            className="text-destructive"
            onClick={onDelete}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

function formatDate(iso?: string): string {
  if (!iso) return ''

  const d = new Date(iso)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  const days = Math.floor(diff / 86400000)

  if (days === 0) {
    return d.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  if (days < 7) {
    return d.toLocaleDateString([], {
      weekday: 'long',
    })
  }

  return d.toLocaleDateString([], {
    day: 'numeric',
    month: 'short',
  })
}
