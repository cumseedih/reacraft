// ============ Core Types ============

export type Role = 'user' | 'assistant' | 'system'
export type MessageStatus = 'pending' | 'streaming' | 'done' | 'error'

export interface User {
  id: string
  email: string
  name: string
  avatar?: string
  plan: 'free' | 'pro' | 'max' | 'ultra'
  createdAt: string
}

export interface Conversation {
  id: string
  title: string
  model: string
  projectId?: string
  pinned: boolean
  archived: boolean
  createdAt: string
  updatedAt: string
  messageCount?: number
  lastMessage?: string
}

export interface Message {
  id: string
  conversationId: string
  role: Role
  content: string | MessageContent[]
  model?: string
  status: MessageStatus
  tokens?: { input: number; output: number }
  attachments?: Attachment[]
  feedback?: 'up' | 'down' | null
  createdAt: string
  updatedAt: string
}

export type MessageContent =
  | { type: 'text'; text: string }
  | { type: 'image'; url: string; alt?: string }
  | { type: 'file'; name: string; url: string; mimeType: string; size: number }
  | { type: 'artifact'; artifactId: string }

export interface Attachment {
  id: string
  name: string
  url: string
  mimeType: string
  size: number
  extractedText?: string
}

export interface Project {
  id: string
  name: string
  description?: string
  instructions?: string
  color?: string
  icon?: string
  conversationCount: number
  fileCount: number
  createdAt: string
  updatedAt: string
}

export interface ProjectFile {
  id: string
  projectId: string
  name: string
  url: string
  mimeType: string
  size: number
  extractedText?: string
  vectorized: boolean
  createdAt: string
}

export interface Artifact {
  id: string
  conversationId: string
  messageId: string
  title: string
  type: ArtifactType
  content: string
  language?: string
  version: number
  versions?: ArtifactVersion[]
  createdAt: string
  updatedAt: string
}

export type ArtifactType = 'code' | 'html' | 'react' | 'markdown' | 'chart' | 'diagram' | 'presentation' | 'document'

export interface ArtifactVersion {
  id: string
  artifactId: string
  content: string
  version: number
  createdAt: string
}

export interface Model {
  id: string
  name: string
  provider: Provider
  contextWindow: number
  supportsImages: boolean
  supportsFiles: boolean
  supportsVoice: boolean
  supportsSearch: boolean
  supportsArtifacts: boolean
  maxOutputTokens: number
  inputCostPer1k: number
  outputCostPer1k: number
  tier?: 'ultra' | 'pro' | 'free' | 'research'
  description?: string
  capabilities?: string[]
}

export type Provider = 'anthropic' | 'openai' | 'google' | 'openai-compat' | 'local' | 'kroex'

export interface ApiKey {
  id: string
  provider: Provider
  name: string
  keyHint: string  // last 4 chars only
  createdAt: string
  isActive: boolean
}

export interface Memory {
  id: string
  content: string
  source: 'conversation' | 'explicit' | 'inferred'
  conversationId?: string
  createdAt: string
  updatedAt: string
}

export interface SearchResult {
  id: string
  url: string
  title: string
  snippet: string
  publishedDate?: string
}

export interface ResearchStep {
  id: string
  query: string
  results: SearchResult[]
  summary: string
  status: 'pending' | 'searching' | 'done' | 'error'
}

export interface ConnectorTool {
  id: string
  name: string
  description: string
  inputSchema: Record<string, unknown>
  serverId: string
}

export interface McpServer {
  id: string
  name: string
  url?: string
  command?: string
  args?: string[]
  env?: Record<string, string>
  tools: ConnectorTool[]
  status: 'connected' | 'disconnected' | 'error'
}

export interface ScheduledTask {
  id: string
  name: string
  prompt: string
  schedule?: string  // cron
  runOnce?: string  // ISO date
  enabled: boolean
  lastRun?: string
  nextRun?: string
  createdAt: string
}

export interface UsageStats {
  period: string
  inputTokens: number
  outputTokens: number
  totalCost: number
  conversationCount: number
  messageCount: number
}

export interface AppSettings {
  theme: 'light' | 'dark' | 'system'
  language: string
  defaultModel: string
  defaultProvider: Provider
  enableMemory: boolean
  enableSearch: boolean
  enableVoice: boolean
  enableAnalytics: boolean
  fontSize: 'sm' | 'md' | 'lg'
  codeTheme: string
  enterToSend: boolean
  showTokenCount: boolean
}

// API response wrappers
export interface ApiResponse<T> {
  data: T
  message?: string
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
  hasMore: boolean
}

export interface ApiError {
  message: string
  code?: string
  details?: Record<string, string[]>
}
