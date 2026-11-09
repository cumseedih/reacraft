import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AppSettings } from '@/types'

interface SettingsState extends AppSettings {
  sidebarCollapsed: boolean
  update: (patch: Partial<AppSettings & { sidebarCollapsed: boolean }>) => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      theme: 'system',
      language: 'en',
      defaultModel: 'kroex-pro',
      defaultProvider: 'anthropic',
      enableMemory: true,
      enableSearch: true,
      enableVoice: true,
      enableAnalytics: false,
      fontSize: 'md',
      codeTheme: 'github-dark',
      enterToSend: true,
      showTokenCount: false,
      sidebarCollapsed: false,
      update: (patch) => set((s) => ({ ...s, ...patch })),
    }),
    { name: 'kroex-settings' }
  )
)
