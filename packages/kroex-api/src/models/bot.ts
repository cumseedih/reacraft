/** Source: API Integration Specification §1.7, §2.2. Flag-gated: bot_enabled (404 when off, §5.3). */
import type { IsoDateTime } from './common.js'

export interface BotStreamRequest {
  /** min_length=1 */
  message: string
  model?: string
}

/**
 * Action registry (services/bot.py ACTION_REGISTRY, spec §1.7).
 * Actions marked requiresConfirmation stay in status "proposed" until the
 * client calls confirm/reject (or the sandbox approval surface, §1.9).
 */
export const BOT_ACTION_REGISTRY = {
  'project.list': { requiresConfirmation: false },
  'project.create': { requiresConfirmation: false },
  'project.delete': { requiresConfirmation: true },
  'memory.list': { requiresConfirmation: false },
  'memory.create': { requiresConfirmation: false },
  'memory.delete': { requiresConfirmation: true },
  'conversation.list': { requiresConfirmation: false },
  'sandbox.list': { requiresConfirmation: false },
  'sandbox.create': { requiresConfirmation: true },
  'sandbox.exec': { requiresConfirmation: true },
  'sandbox.stop': { requiresConfirmation: true },
} as const satisfies Record<string, { requiresConfirmation: boolean }>

export type BotActionName = keyof typeof BOT_ACTION_REGISTRY

export interface BotActionOut {
  id: string
  /** Not narrowed to BotActionName: the server is the source of truth and may add actions the client doesn't yet know. */
  action: string
  arguments: Record<string, unknown>
  status: string
  result?: Record<string, unknown> | null
  error?: string | null
  conversation_id: string
  message_id?: string | null
  created_at: IsoDateTime
  executed_at?: IsoDateTime | null
}
