import { Platform } from 'react-native'

/**
 * Centralized runtime configuration for the KROEX mobile app.
 *
 * The backend base URL is resolved from EXPO_PUBLIC_API_URL (inlined at build
 * time by Expo). We deliberately do NOT fall back to localhost on native
 * devices: `localhost` on a physical phone points at the phone itself, which
 * is never the backend, and silently using it produces the confusing
 * "Failed to connect to localhost/127.0.0.1:8000" error.
 */

export type AppEnv = 'development' | 'staging' | 'production'

export const APP_ENV: AppEnv =
  (process.env.EXPO_PUBLIC_ENV as AppEnv) || 'development'

const configuredUrl = (process.env.EXPO_PUBLIC_API_URL ?? '')
  .trim()
  .replace(/\/+$/, '')

function isLocalhost(url: string): boolean {
  return /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?(\/|$)/i.test(url)
}

/** On web the dev server and browser share localhost, so it is a safe default. */
const WEB_DEV_DEFAULT = 'http://localhost:8000'

export class ApiConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ApiConfigError'
  }
}

interface ResolvedApiConfig {
  baseUrl: string | null
  error: string | null
}

function resolveApiConfig(): ResolvedApiConfig {
  if (configuredUrl) {
    if (Platform.OS !== 'web' && isLocalhost(configuredUrl)) {
      return {
        baseUrl: null,
        error:
          'EXPO_PUBLIC_API_URL is set to a localhost address, which a physical ' +
          'device cannot reach. Point it at your computer’s LAN IP ' +
          '(e.g. http://192.168.1.50:8000) or a deployed backend URL.',
      }
    }
    return { baseUrl: configuredUrl, error: null }
  }

  if (Platform.OS === 'web') {
    return { baseUrl: WEB_DEV_DEFAULT, error: null }
  }

  return {
    baseUrl: null,
    error:
      'No backend is configured. Set EXPO_PUBLIC_API_URL in apps/mobile/.env to ' +
      'a URL this device can reach — your computer’s LAN IP ' +
      '(e.g. http://192.168.1.50:8000) or a deployed server. A phone cannot use ' +
      'localhost.',
  }
}

const resolved = resolveApiConfig()

export const API_BASE_URL: string | null = resolved.baseUrl
export const API_CONFIG_ERROR: string | null = resolved.error

/** Returns the base URL or throws an ApiConfigError with an actionable message. */
export function requireApiBaseUrl(): string {
  if (!API_BASE_URL) {
    throw new ApiConfigError(
      API_CONFIG_ERROR ?? 'The KROEX backend URL is not configured.',
    )
  }
  return API_BASE_URL
}
