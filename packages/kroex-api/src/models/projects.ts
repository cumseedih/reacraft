/** Source: API Integration Specification §1.3, §1.4. */
import type { IsoDateTime } from './common'

export interface ProjectCreate {
  name: string
  description?: string | null
  system_prompt?: string | null
  color?: string | null
  icon?: string | null
}

export interface ProjectOut {
  id: string
  name: string
  description?: string | null
  system_prompt?: string | null
  color?: string | null
  icon?: string | null
  created_at: IsoDateTime
  updated_at: IsoDateTime
}

/**
 * Allowed upload extensions and the content type the backend assigns.
 * Source: services/document.py EXTENSION_TO_CONTENT_TYPE (spec §1.4).
 * Any other extension -> 422 "Unsupported file type. Allowed: ...".
 */
export const PROJECT_FILE_EXTENSION_TO_CONTENT_TYPE: Record<string, string> = {
  '.txt': 'text/plain',
  '.md': 'text/markdown',
  '.pdf': 'application/pdf',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
}

export interface FileOut {
  id: string
  name: string
  content_type: string
  size: number
  /** 0 immediately after upload; processing (extract/embed) is async. */
  chunk_count: number
  created_at: IsoDateTime
}
