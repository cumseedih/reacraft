import { KROEX_MODEL_IDS, DEFAULT_KROEX_MODEL_ID, type KroexModelId } from '@kroex/api'

/**
 * Mobile-facing model catalog. The supported IDs are the single source of
 * truth from @kroex/api (KROEX_MODEL_IDS) — only the four tiers that actually
 * complete on staging. Legacy provider IDs are intentionally never surfaced
 * (Phase-4 directive: do not expose unsupported legacy model identifiers).
 */
export interface MobileModel {
  id: KroexModelId
  name: string
  description: string
  contextLabel: string
  /** Ionicons glyph name for the tier. */
  icon: string
}

const CATALOG: Record<KroexModelId, Omit<MobileModel, 'id'>> = {
  'kroex-ultra': {
    name: 'KROEX Ultra',
    description: 'Maximum intelligence for complex, nuanced tasks',
    contextLabel: '200K context',
    icon: 'sparkles',
  },
  'kroex-pro': {
    name: 'KROEX Pro',
    description: 'Balanced power and speed for most tasks',
    contextLabel: '100K context',
    icon: 'flash',
  },
  'kroex-fast': {
    name: 'KROEX Fast',
    description: 'Lightweight and snappy for quick answers',
    contextLabel: '32K context',
    icon: 'rocket',
  },
  'kroex-auto': {
    name: 'KROEX Auto',
    description: 'Automatically routes to the best tier for each task',
    contextLabel: 'Adaptive',
    icon: 'git-branch',
  },
}

/** The ordered list of selectable models (exactly the supported IDs). */
export const MOBILE_MODELS: MobileModel[] = KROEX_MODEL_IDS.map((id) => ({
  id,
  ...CATALOG[id],
}))

export const DEFAULT_MODEL_ID: KroexModelId = DEFAULT_KROEX_MODEL_ID

/** Human label for any model id; falls back to the raw id if somehow unknown. */
export function modelLabel(id: string): string {
  const entry = (CATALOG as Record<string, Omit<MobileModel, 'id'> | undefined>)[id]
  return entry ? entry.name : id
}
