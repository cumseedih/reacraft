/** Source: API Integration Specification §1.1, §4.1. */
import type { IsoDateTime } from './common'

export interface RegisterRequest {
  name: string
  email: string
  /** >= 8 characters (register validator). */
  password: string
}

export interface LoginRequest {
  email: string
  password: string
}

export interface UserOut {
  id: string
  email: string
  name: string
  avatar?: string | null
  plan: string
}

export interface AuthResponse {
  user: UserOut
  /** Field is named "token" (NOT "access_token"). JWT, 7-day expiry (§4.1). */
  token: string
}

/** Decoded JWT payload shape (§4.1) — for reference only; never decode/trust client-side for auth decisions. */
export interface JwtPayload {
  sub: string
  exp: number
}
