import { createKroexClient, uploadProjectFile, type KroexClient } from '@kroex/api'

/**
 * Shared @kroex/api client for the web app.
 *
 * baseUrl defaults to '' (same-origin) so requests hit this app's own
 * /api/* proxy route, which forwards server-side to BACKEND_URL — the path
 * STAGING_CONFIG.md prescribes (the staging API is loopback-only, so the
 * browser cannot call it directly, and there is no CORS dependency).
 * NEXT_PUBLIC_API_URL remains a direct-call escape hatch for local dev.
 *
 * One shared instance; no duplicate fetch implementations in feature code.
 */
let cached: KroexClient | null = null

export function getKroexClient(): KroexClient {
  if (cached) return cached
  cached = createKroexClient({
    baseUrl: process.env.NEXT_PUBLIC_API_URL ?? '',
    getToken: () => (typeof window !== 'undefined' ? localStorage.getItem('kroex_token') : null),
  })
  return cached
}

/** Multipart project-file upload helper, bound to the same config. */
export function uploadFile(projectId: string, form: FormData) {
  return uploadProjectFile(
    {
      baseUrl: process.env.NEXT_PUBLIC_API_URL ?? '',
      getToken: () => (typeof window !== 'undefined' ? localStorage.getItem('kroex_token') : null),
    },
    projectId,
    form,
  )
}
