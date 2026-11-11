/**
 * Client-facing KROEX model catalog.
 * Source: API Integration Specification §8.
 *
 * Staging verified (2026-11-10): only these four IDs complete on staging.
 * The spec's §8 table also lists legacy IDs (gpt-4o, gpt-4o-mini,
 * gemini-flash, gemini-pro) that validate but fail in-stream on staging
 * (no provider keys configured there). Per the Phase-4 directive
 * ("Do not expose unsupported legacy model identifiers"), this package's
 * public catalog intentionally contains ONLY the four supported tiers —
 * the legacy IDs are not exported from here.
 */
export const KROEX_MODEL_IDS = ['kroex-ultra', 'kroex-pro', 'kroex-fast', 'kroex-auto'] as const

export type KroexModelId = (typeof KROEX_MODEL_IDS)[number]

export function isKroexModelId(value: string): value is KroexModelId {
  return (KROEX_MODEL_IDS as readonly string[]).includes(value)
}

/** Default model id used when a request omits one (spec §8: all four default-bearing schemas use this). */
export const DEFAULT_KROEX_MODEL_ID: KroexModelId = 'kroex-pro'
