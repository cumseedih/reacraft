/**
 * Typed endpoint client — one method per documented HTTP endpoint, built on
 * the transport-agnostic request() core. Source of truth: API Integration
 * Specification §1 (routes) and §5 (status/error contract).
 *
 * Scope notes baked in per the Phase-4 directive:
 *  - The four streaming endpoints (§2.1-§2.4) are NOT here — they need the raw
 *    response body, not JSON. Use the sse/* parsers with each platform's
 *    streaming primitive. Methods here that START a stream server-side
 *    (none do synchronously) are absent by design.
 *  - The PTY WebSocket (§3) is not an HTTP endpoint; see ws/pty.ts.
 *  - Code review endpoints (§1.10) are intentionally omitted: that surface is
 *    disabled on staging and must stay disabled. Its MODELS exist for
 *    completeness, but exposing client methods would invite calling a 404
 *    surface, so they are not wired here.
 */
import type { KroexClientConfig, RequestOptions } from './types'
import { request, type JsonRequestInit } from './http'
import type { AuthResponse, LoginRequest, RegisterRequest, UserOut } from '../models/auth'
import type { ConversationOut, MessageOut } from '../models/chat'
import type { ProjectCreate, ProjectOut, FileOut } from '../models/projects'
import type { MemoryCreate, MemoryOut, MemorySearchResult } from '../models/memory'
import type { ArtifactOut } from '../models/artifacts'
import type { BotActionOut } from '../models/bot'
import type {
  AgentCreate, AgentOut, AgentRunCreate, AgentRunOut, AgentUpdate,
  ScheduleCreate, ScheduleOut, ScheduleUpdate,
} from '../models/agents'
import type {
  ApprovalOut, CommandCreate, CommandOut, EgressGrantCreate, EgressGrantOut,
  EgressPolicyCreate, EgressPolicyOut, PatchOut, SandboxConfigOut, SessionCreate,
  SessionOut, SessionStop, SnapshotCreate, SnapshotOut, WorkspaceCreate,
  WorkspaceDestroy, WorkspaceOut,
} from '../models/sandbox'

export interface KroexClient {
  readonly config: KroexClientConfig
  auth: AuthApi
  chat: ChatApi
  projects: ProjectsApi
  memory: MemoryApi
  artifacts: ArtifactsApi
  bot: BotApi
  agents: AgentsApi
  sandbox: SandboxApi
}

export interface AuthApi {
  register(body: RegisterRequest, opts?: RequestOptions): Promise<AuthResponse>
  login(body: LoginRequest, opts?: RequestOptions): Promise<AuthResponse>
  me(opts?: RequestOptions): Promise<UserOut>
}

export interface ChatApi {
  listConversations(opts?: RequestOptions): Promise<ConversationOut[]>
  listMessages(conversationId: string, opts?: RequestOptions): Promise<MessageOut[]>
  // Note: POST /api/chat/stream is a stream — not here; use sse/* parsers.
}

export interface ProjectsApi {
  list(opts?: RequestOptions): Promise<ProjectOut[]>
  create(body: ProjectCreate, opts?: RequestOptions): Promise<ProjectOut>
  remove(projectId: string, opts?: RequestOptions): Promise<void>
  listFiles(projectId: string, opts?: RequestOptions): Promise<FileOut[]>
  deleteFile(projectId: string, fileId: string, opts?: RequestOptions): Promise<void>
  // File UPLOAD is multipart, not JSON — see uploadProjectFile() below.
}

export interface MemoryApi {
  list(opts?: RequestOptions): Promise<MemoryOut[]>
  search(q: string, limit?: number, opts?: RequestOptions): Promise<MemorySearchResult>
  create(body: MemoryCreate, opts?: RequestOptions): Promise<MemoryOut>
  remove(memoryId: string, opts?: RequestOptions): Promise<void>
}

export interface ArtifactsApi {
  list(opts?: RequestOptions): Promise<ArtifactOut[]>
  listForConversation(conversationId: string, opts?: RequestOptions): Promise<ArtifactOut[]>
  remove(artifactId: string, opts?: RequestOptions): Promise<void>
}

export interface BotApi {
  getConversation(opts?: RequestOptions): Promise<ConversationOut>
  listActions(statusFilter?: string, limit?: number, opts?: RequestOptions): Promise<BotActionOut[]>
  confirmAction(actionId: string, opts?: RequestOptions): Promise<BotActionOut>
  rejectAction(actionId: string, opts?: RequestOptions): Promise<BotActionOut>
  // POST /api/bot/chat/stream is a stream — not here.
}

export interface AgentsApi {
  create(body: AgentCreate, opts?: RequestOptions): Promise<AgentOut>
  list(opts?: RequestOptions): Promise<AgentOut[]>
  get(agentId: string, opts?: RequestOptions): Promise<AgentOut>
  update(agentId: string, body: AgentUpdate, opts?: RequestOptions): Promise<AgentOut>
  remove(agentId: string, opts?: RequestOptions): Promise<void>
  /** Returns 202 Accepted — a worker executes; poll the run or its event stream (§2.3). */
  run(agentId: string, body: AgentRunCreate, opts?: RequestOptions): Promise<AgentRunOut>
  listRuns(agentId: string, opts?: RequestOptions): Promise<AgentRunOut[]>
  getRun(runId: string, opts?: RequestOptions): Promise<AgentRunOut>
  cancelRun(runId: string, opts?: RequestOptions): Promise<AgentRunOut>
  createSchedule(agentId: string, body: ScheduleCreate, opts?: RequestOptions): Promise<ScheduleOut>
  listSchedules(agentId: string, opts?: RequestOptions): Promise<ScheduleOut[]>
  updateSchedule(scheduleId: string, body: ScheduleUpdate, opts?: RequestOptions): Promise<ScheduleOut>
  deleteSchedule(scheduleId: string, opts?: RequestOptions): Promise<void>
}

export interface SandboxApi {
  getConfig(opts?: RequestOptions): Promise<SandboxConfigOut>
  createWorkspace(body: WorkspaceCreate, opts?: RequestOptions): Promise<WorkspaceOut>
  listWorkspaces(opts?: RequestOptions): Promise<WorkspaceOut[]>
  getWorkspace(workspaceId: string, opts?: RequestOptions): Promise<WorkspaceOut>
  destroyWorkspace(workspaceId: string, body: WorkspaceDestroy, opts?: RequestOptions): Promise<{ workspace_id: string; status: string }>
  createSession(body: SessionCreate, opts?: RequestOptions): Promise<SessionOut>
  listSessions(workspaceId?: string, opts?: RequestOptions): Promise<SessionOut[]>
  getSession(sessionId: string, opts?: RequestOptions): Promise<SessionOut>
  stopSession(sessionId: string, body?: SessionStop, opts?: RequestOptions): Promise<{ session_id: string; status: string }>
  resumeSession(sessionId: string, opts?: RequestOptions): Promise<SessionOut>
  destroySession(sessionId: string, opts?: RequestOptions): Promise<{ session_id: string; status: string }>
  createCommand(sessionId: string, body: CommandCreate, opts?: RequestOptions): Promise<CommandOut>
  getCommand(commandId: string, opts?: RequestOptions): Promise<CommandOut>
  cancelCommand(commandId: string, opts?: RequestOptions): Promise<{ command_id: string; status: string }>
  // GET /api/sandbox/commands/{id}/events is a stream — see sse/named.ts.
  createSnapshot(workspaceId: string, body?: SnapshotCreate, opts?: RequestOptions): Promise<SnapshotOut>
  listSnapshots(workspaceId: string, opts?: RequestOptions): Promise<SnapshotOut[]>
  getSnapshot(snapshotId: string, opts?: RequestOptions): Promise<SnapshotOut>
  restoreSnapshot(snapshotId: string, opts?: RequestOptions): Promise<SnapshotOut>
  deleteSnapshot(snapshotId: string, opts?: RequestOptions): Promise<SnapshotOut>
  getPatch(patchId: string, opts?: RequestOptions): Promise<PatchOut>
  listPatches(workspaceId: string, opts?: RequestOptions): Promise<PatchOut[]>
  /** Explicit, authenticated owner action — the ONLY way a patch is applied (spec §1.9). Never call automatically. */
  applyPatch(patchId: string, opts?: RequestOptions): Promise<PatchOut>
  rejectPatch(patchId: string, opts?: RequestOptions): Promise<PatchOut>
  createEgressPolicy(body: EgressPolicyCreate, opts?: RequestOptions): Promise<EgressPolicyOut>
  listEgressPolicies(opts?: RequestOptions): Promise<EgressPolicyOut[]>
  deleteEgressPolicy(policyId: string, opts?: RequestOptions): Promise<{ policy_id: string; status: string }>
  createEgressGrant(sessionId: string, body: EgressGrantCreate, opts?: RequestOptions): Promise<EgressGrantOut>
  deleteEgressGrant(grantId: string, opts?: RequestOptions): Promise<EgressGrantOut>
  listApprovals(status?: string, opts?: RequestOptions): Promise<ApprovalOut[]>
  approveApproval(approvalId: string, opts?: RequestOptions): Promise<ApprovalOut>
  denyApproval(approvalId: string, opts?: RequestOptions): Promise<ApprovalOut>
}

/** Builds a typed client bound to a config. Pure factory — no network on construction. */
export function createKroexClient(config: KroexClientConfig): KroexClient {
  const call = <T>(init: JsonRequestInit, opts?: RequestOptions) => request<T>(config, init, opts)

  return {
    config,
    auth: {
      register: (body, o) => call({ method: 'POST', path: '/api/auth/register', body }, o),
      login: (body, o) => call({ method: 'POST', path: '/api/auth/login', body }, o),
      me: (o) => call({ method: 'GET', path: '/api/auth/me' }, o),
    },
    chat: {
      listConversations: (o) => call({ method: 'GET', path: '/api/conversations' }, o),
      listMessages: (id, o) => call({ method: 'GET', path: `/api/conversations/${id}/messages` }, o),
    },
    projects: {
      list: (o) => call({ method: 'GET', path: '/api/projects' }, o),
      create: (body, o) => call({ method: 'POST', path: '/api/projects', body }, o),
      remove: (id, o) => call({ method: 'DELETE', path: `/api/projects/${id}` }, o),
      listFiles: (id, o) => call({ method: 'GET', path: `/api/projects/${id}/files` }, o),
      deleteFile: (id, fid, o) => call({ method: 'DELETE', path: `/api/projects/${id}/files/${fid}` }, o),
    },
    memory: {
      list: (o) => call({ method: 'GET', path: '/api/memory' }, o),
      search: (q, limit, o) => call({ method: 'GET', path: '/api/memory/search', query: { q, limit } }, o),
      create: (body, o) => call({ method: 'POST', path: '/api/memory', body }, o),
      remove: (id, o) => call({ method: 'DELETE', path: `/api/memory/${id}` }, o),
    },
    artifacts: {
      list: (o) => call({ method: 'GET', path: '/api/artifacts' }, o),
      listForConversation: (id, o) => call({ method: 'GET', path: `/api/artifacts/conversation/${id}` }, o),
      remove: (id, o) => call({ method: 'DELETE', path: `/api/artifacts/${id}` }, o),
    },
    bot: {
      getConversation: (o) => call({ method: 'GET', path: '/api/bot/conversation' }, o),
      listActions: (status_filter, limit, o) => call({ method: 'GET', path: '/api/bot/actions', query: { status_filter, limit } }, o),
      confirmAction: (id, o) => call({ method: 'POST', path: `/api/bot/actions/${id}/confirm` }, o),
      rejectAction: (id, o) => call({ method: 'POST', path: `/api/bot/actions/${id}/reject` }, o),
    },
    agents: {
      create: (body, o) => call({ method: 'POST', path: '/api/agents', body }, o),
      list: (o) => call({ method: 'GET', path: '/api/agents' }, o),
      get: (id, o) => call({ method: 'GET', path: `/api/agents/${id}` }, o),
      update: (id, body, o) => call({ method: 'PATCH', path: `/api/agents/${id}`, body }, o),
      remove: (id, o) => call({ method: 'DELETE', path: `/api/agents/${id}` }, o),
      run: (id, body, o) => call({ method: 'POST', path: `/api/agents/${id}/run`, body }, o),
      listRuns: (id, o) => call({ method: 'GET', path: `/api/agents/${id}/runs` }, o),
      getRun: (runId, o) => call({ method: 'GET', path: `/api/agent-runs/${runId}` }, o),
      cancelRun: (runId, o) => call({ method: 'POST', path: `/api/agent-runs/${runId}/cancel` }, o),
      createSchedule: (id, body, o) => call({ method: 'POST', path: `/api/agents/${id}/schedules`, body }, o),
      listSchedules: (id, o) => call({ method: 'GET', path: `/api/agents/${id}/schedules` }, o),
      updateSchedule: (sid, body, o) => call({ method: 'PATCH', path: `/api/agent-schedules/${sid}`, body }, o),
      deleteSchedule: (sid, o) => call({ method: 'DELETE', path: `/api/agent-schedules/${sid}` }, o),
    },
    sandbox: {
      getConfig: (o) => call({ method: 'GET', path: '/api/sandbox/config' }, o),
      createWorkspace: (body, o) => call({ method: 'POST', path: '/api/sandbox/workspaces', body }, o),
      listWorkspaces: (o) => call({ method: 'GET', path: '/api/sandbox/workspaces' }, o),
      getWorkspace: (id, o) => call({ method: 'GET', path: `/api/sandbox/workspaces/${id}` }, o),
      destroyWorkspace: (id, body, o) => call({ method: 'DELETE', path: `/api/sandbox/workspaces/${id}`, body }, o),
      createSession: (body, o) => call({ method: 'POST', path: '/api/sandbox/sessions', body }, o),
      listSessions: (workspace_id, o) => call({ method: 'GET', path: '/api/sandbox/sessions', query: { workspace_id } }, o),
      getSession: (id, o) => call({ method: 'GET', path: `/api/sandbox/sessions/${id}` }, o),
      stopSession: (id, body, o) => call({ method: 'POST', path: `/api/sandbox/sessions/${id}/stop`, body: body ?? {} }, o),
      resumeSession: (id, o) => call({ method: 'POST', path: `/api/sandbox/sessions/${id}/resume` }, o),
      destroySession: (id, o) => call({ method: 'DELETE', path: `/api/sandbox/sessions/${id}` }, o),
      createCommand: (sid, body, o) => call({ method: 'POST', path: `/api/sandbox/sessions/${sid}/commands`, body }, o),
      getCommand: (id, o) => call({ method: 'GET', path: `/api/sandbox/commands/${id}` }, o),
      cancelCommand: (id, o) => call({ method: 'POST', path: `/api/sandbox/commands/${id}/cancel` }, o),
      createSnapshot: (wid, body, o) => call({ method: 'POST', path: `/api/sandbox/workspaces/${wid}/snapshots`, body: body ?? {} }, o),
      listSnapshots: (wid, o) => call({ method: 'GET', path: `/api/sandbox/workspaces/${wid}/snapshots` }, o),
      getSnapshot: (id, o) => call({ method: 'GET', path: `/api/sandbox/snapshots/${id}` }, o),
      restoreSnapshot: (id, o) => call({ method: 'POST', path: `/api/sandbox/snapshots/${id}/restore` }, o),
      deleteSnapshot: (id, o) => call({ method: 'DELETE', path: `/api/sandbox/snapshots/${id}` }, o),
      getPatch: (id, o) => call({ method: 'GET', path: `/api/sandbox/patches/${id}` }, o),
      listPatches: (wid, o) => call({ method: 'GET', path: `/api/sandbox/workspaces/${wid}/patches` }, o),
      applyPatch: (id, o) => call({ method: 'POST', path: `/api/sandbox/patches/${id}/apply` }, o),
      rejectPatch: (id, o) => call({ method: 'POST', path: `/api/sandbox/patches/${id}/reject` }, o),
      createEgressPolicy: (body, o) => call({ method: 'POST', path: '/api/sandbox/egress-policies', body }, o),
      listEgressPolicies: (o) => call({ method: 'GET', path: '/api/sandbox/egress-policies' }, o),
      deleteEgressPolicy: (id, o) => call({ method: 'DELETE', path: `/api/sandbox/egress-policies/${id}` }, o),
      createEgressGrant: (sid, body, o) => call({ method: 'POST', path: `/api/sandbox/sessions/${sid}/egress-grants`, body }, o),
      deleteEgressGrant: (id, o) => call({ method: 'DELETE', path: `/api/sandbox/egress-grants/${id}` }, o),
      listApprovals: (status, o) => call({ method: 'GET', path: '/api/sandbox/approvals', query: { status } }, o),
      approveApproval: (id, o) => call({ method: 'POST', path: `/api/sandbox/approvals/${id}/approve` }, o),
      denyApproval: (id, o) => call({ method: 'POST', path: `/api/sandbox/approvals/${id}/deny` }, o),
    },
  }
}

/**
 * Project file upload is multipart/form-data, not JSON, so it bypasses the
 * JSON request() core. Field name must be `file` (spec §1.4). Caller supplies
 * a platform FormData (web/React Native both have it).
 */
export async function uploadProjectFile(
  config: KroexClientConfig,
  projectId: string,
  form: FormData,
  opts: RequestOptions = {},
): Promise<FileOut> {
  const fetchImpl = config.fetchImpl ?? fetch
  const token = await config.getToken()
  const base = config.baseUrl.endsWith('/') ? config.baseUrl.slice(0, -1) : config.baseUrl
  const res = await fetchImpl(`${base}/api/projects/${projectId}/files`, {
    method: 'POST',
    // NB: do NOT set Content-Type — the platform sets the multipart boundary.
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...opts.headers },
    body: form,
    signal: opts.signal,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => undefined)
    const { toKroexApiError } = await import('../errors')
    throw toKroexApiError(res.status, body, res.headers.get('Retry-After'))
  }
  return (await res.json()) as FileOut
}
