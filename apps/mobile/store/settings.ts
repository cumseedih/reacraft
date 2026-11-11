import { create } from 'zustand'
import * as SecureStore from 'expo-secure-store'
import { isKroexModelId, type KroexModelId } from '@kroex/api'
import { DEFAULT_MODEL_ID } from '../lib/models'

const KEY = 'kroex_default_model'

interface SettingsState {
  defaultModel: KroexModelId
  hydrated: boolean
  setDefaultModel: (id: KroexModelId) => Promise<void>
  hydrate: () => Promise<void>
}

/**
 * Persisted app settings. Only the default model id is stored (a harmless,
 * non-secret preference). SecureStore is used simply because it is already a
 * dependency; the value is validated against the supported model IDs on read
 * so a stale/unknown id can never be applied.
 */
export const useSettingsStore = create<SettingsState>((set) => ({
  defaultModel: DEFAULT_MODEL_ID,
  hydrated: false,
  setDefaultModel: async (id) => {
    set({ defaultModel: id })
    try {
      await SecureStore.setItemAsync(KEY, id)
    } catch {
      // Non-fatal: preference just won't persist across launches.
    }
  },
  hydrate: async () => {
    try {
      const stored = await SecureStore.getItemAsync(KEY)
      if (stored && isKroexModelId(stored)) {
        set({ defaultModel: stored, hydrated: true })
        return
      }
    } catch {
      // ignore
    }
    set({ hydrated: true })
  },
}))
