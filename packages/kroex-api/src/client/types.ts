/**
 * Transport-agnostic client config. The same request() function in http.ts
 * runs on web, mobile and desktop — only the injected `fetchImpl` and
 * `getToken` differ per platform (web: native fetch + localStorage; mobile:
 * native fetch + expo-secure-store; desktop: Tauri plugin-http's fetch +
 * an OS-keychain-backed token store — see the Increment A report for the
 * desktop design, not yet wired up here).
 */
export interface KroexClientConfig {
  /** Platform-specific API base URL (spec §7: NEXT_PUBLIC_API_URL / EXPO_PUBLIC_API_URL / desktop equivalent). No default is baked in here — callers must configure it explicitly per the Phase-4 directive against hardcoding staging URLs. */
  baseUrl: string
  /** Returns the current JWT, or null if signed out. May be async (e.g. secure-store reads). */
  getToken: () => Promise<string | null> | string | null
  /** Defaults to the global fetch. Inject a platform fetch (e.g. Tauri's plugin-http fetch) to route requests appropriately. */
  fetchImpl?: typeof fetch
  /** Default request timeout in ms. Spec does not mandate a client timeout; this is a client-side safety net, not a server contract. */
  defaultTimeoutMs?: number
}

export interface RequestOptions {
  /** Caller-provided cancellation (e.g. component unmount). Composed with the internal timeout controller. */
  signal?: AbortSignal
  /** Overrides config.defaultTimeoutMs for this call. Pass null to disable the timeout entirely (needed for long-lived SSE connections, which manage their own lifecycle). */
  timeoutMs?: number | null
  headers?: Record<string, string>
}

export const DEFAULT_TIMEOUT_MS = 30_000
