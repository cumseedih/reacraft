/** Source: API Integration Specification §1.8. Flag-gated: agents_enabled (404 when off, §5.3). */
import type { IsoDateTime } from './common'

export interface AgentCreate {
  /** 1-255 chars */
  name: string
  instructions?: string
  model?: string
  project_id?: string | null
  config?: Record<string, unknown>
}

export interface AgentUpdate {
  name?: string
  instructions?: string
  model?: string
  project_id?: string | null
  enabled?: boolean
  config?: Record<string, unknown>
}

export interface AgentOut {
  id: string
  name: string
  instructions: string
  model: string
  project_id?: string | null
  conversation_id: string
  enabled: boolean
  config: Record<string, unknown>
  created_at: IsoDateTime
  updated_at: IsoDateTime
}

export type AgentRunExecutionMode = 'chat' | 'sandbox'

export interface FanoutSpec {
  /** 1-16 */
  count: number
  task?: string | null
}

export interface AgentRunCreate {
  prompt?: string | null
  /** Supplying `fanout` implies execution_mode='sandbox'. */
  execution_mode?: AgentRunExecutionMode | null
  fanout?: FanoutSpec | null
}

/** Terminal = {succeeded, failed, cancelled, dead} (routers/agents.py TERMINAL_RUN_STATUSES). */
export type AgentRunStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled' | 'dead'

export const TERMINAL_RUN_STATUSES: readonly AgentRunStatus[] = ['succeeded', 'failed', 'cancelled', 'dead']

export function isTerminalRunStatus(status: string): boolean {
  return (TERMINAL_RUN_STATUSES as readonly string[]).includes(status)
}

export interface AgentRunOut {
  id: string
  agent_id: string
  trigger: string
  status: string
  conversation_id: string
  result_summary?: string | null
  error?: string | null
  attempts: number
  tokens_in: number
  tokens_out: number
  execution_mode: string
  patch_id?: string | null
  parent_run_id?: string | null
  created_at: IsoDateTime
  started_at?: IsoDateTime | null
  finished_at?: IsoDateTime | null
}

export type ScheduleKind = 'cron' | 'interval' | 'event'

/** event kind requires event in KNOWN_EVENTS (routers/agents.py:40). */
export const KNOWN_SCHEDULE_EVENTS = ['project.file_added'] as const
export type KnownScheduleEvent = (typeof KNOWN_SCHEDULE_EVENTS)[number]

export interface ScheduleCreate {
  kind: ScheduleKind
  cron?: string | null
  interval_seconds?: number | null
  event?: string | null
  timezone?: string
  enabled?: boolean
}

export interface ScheduleUpdate extends Partial<ScheduleCreate> {}

export interface ScheduleOut {
  id: string
  agent_id: string
  kind: ScheduleKind
  cron?: string | null
  interval_seconds?: number | null
  event?: string | null
  timezone: string
  next_run_at?: IsoDateTime | null
  last_run_at?: IsoDateTime | null
  enabled: boolean
  created_at: IsoDateTime
  updated_at: IsoDateTime
}
