import * as SecureStore from 'expo-secure-store'
import { createKroexClient, type KroexClient } from '@kroex/api'
import { requireApiBaseUrl } from './config'

/**
 * Lazily-built shared API client for the mobile app.
 *
 * Built per call (cheap) rather than at module load so that a misconfigured
 * native build surfaces the clear ApiConfigError from requireApiBaseUrl()
 * when a screen actually makes a request — instead of crashing on import.
 * Token comes from Expo SecureStore (the same key the web app uses).
 */
export function getClient(): KroexClient {
  return createKroexClient({
    baseUrl: requireApiBaseUrl(),
    getToken: () => SecureStore.getItemAsync('kroex_token'),
    defaultTimeoutMs: 30_000,
  })
}
