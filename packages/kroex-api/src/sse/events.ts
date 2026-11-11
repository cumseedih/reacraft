/**
 * Unnamed SSE event payloads (one discriminated union per endpoint family).
 * Source: API Integration Specification §2.1 (chat), §2.2 (bot), §2.3 (agent-run).
 *
 * IMPORTANT: these three endpoints share the unnamed `data: {json}` dialect
 * but do NOT share one payload shape — bot adds `action`/`action_result`,
 * agent-run adds `run_status`/`sandbox_step` and gives `delta`/`done` and
 * even `error` different meanings than chat's. Do not assume every stream
 * has the same event structure (Phase-4 directive). Each endpoint gets its
 * own type below; UnnamedSseEvent is the parser's generic wire type.
 */

export interface ChatDeltaEvent {
  type: 'delta'
  text: string
}

export interface ChatDoneEvent {
  type: 'done'
  /** The PROVIDER model id (e.g. claude-sonnet-4-6 or, on staging, an agy/* OmniRoute id) — NOT the client-facing tier id. */
  model: string
  usage: { input: number; output: number }
}

export interface ChatErrorEvent {
  type: 'error'
  message: string
}

export interface ChatArtifactEvent {
  type: 'artifact'
  artifact: {
    id: string
    title: string
    type: string
    language: string
    content: string
  }
}

/** POST /api/chat/stream event union (§2.1). artifact events arrive AFTER done, one per extracted code fence. */
export type ChatStreamEvent = ChatDeltaEvent | ChatDoneEvent | ChatErrorEvent | ChatArtifactEvent

export interface BotActionEvent {
  type: 'action'
  action: {
    id: string
    action: string
    status: string
    result: Record<string, unknown> | null
    error: string | null
  }
}

export interface BotActionResultEvent {
  type: 'action_result'
  action_id: string
  result: Record<string, unknown>
}

/**
 * POST /api/bot/chat/stream event union (§2.2). Wraps chat's delta/done/error
 * (pass-1 text is pre-filtered server-side so raw ```kroex-action blocks
 * never reach the client) PLUS action/action_result. Ordering per spec: all
 * `action` events (one per proposal, max 5/turn) after pass 1, then a
 * second pass of ordinary `delta` events narrating outcomes, then `done`.
 */
export type BotStreamEvent =
  | ChatDeltaEvent
  | ChatDoneEvent
  | ChatErrorEvent
  | BotActionEvent
  | BotActionResultEvent

export interface AgentRunStatusEvent {
  type: 'run_status'
  status: string
}

export interface AgentSandboxStepEvent {
  type: 'sandbox_step'
  command_id: string
  command: string
  status: string
  exit_code: number | null
}

export interface AgentRunDeltaEvent {
  type: 'delta'
  /** Whole-message granularity here — NOT token-level like chat's delta (one event per NEW completed assistant message). */
  text: string
}

export interface AgentRunDoneEvent {
  type: 'done'
  /** Final run status; stream closes after this. */
  status: string
}

export interface AgentRunErrorEvent {
  type: 'error'
  /** Two documented messages: "Run not found" (ownership/deletion) or "Events timeout; reconnect to resume" (after 240 polls, ~2 min). */
  message: string
}

/**
 * GET /api/agent-runs/{run_id}/events event union (§2.3). This stream is a
 * poll-based replay (server polls every 0.5s, max 240 polls ≈ 2 min per
 * connection) — a client MUST reconnect after the timeout error; this is
 * expected behaviour, not a failure, and no data is lost on reconnect
 * (spec §9 guidance #11).
 */
export type AgentRunStreamEvent =
  | AgentRunStatusEvent
  | AgentSandboxStepEvent
  | AgentRunDeltaEvent
  | AgentRunDoneEvent
  | AgentRunErrorEvent
