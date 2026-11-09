import * as SecureStore from 'expo-secure-store'
import { requireApiBaseUrl } from './config'

async function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync('kroex_token')
}

/** Thrown when the server cannot be reached (DNS, connection refused, offline). */
export class NetworkError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'NetworkError'
  }
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const baseUrl = requireApiBaseUrl()
  const token = await getToken()

  let res: Response
  try {
    res = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    })
  } catch (e) {
    throw new NetworkError(
      `Can’t reach the KROEX server at ${baseUrl}. Check your connection and ` +
        `that the server is running and reachable from this device.`,
    )
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail ?? `Request failed (${res.status})`)
  }
  return res.json()
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body: unknown) => request<T>('POST', path, body),
  put: <T>(path: string, body: unknown) => request<T>('PUT', path, body),
  delete: <T>(path: string) => request<T>('DELETE', path),
}

export async function* streamSSE(
  path: string,
  body: unknown,
): AsyncGenerator<string> {
  const baseUrl = requireApiBaseUrl()
  const token = await getToken()

  let res: Response
  try {
    res = await fetch(`${baseUrl}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    })
  } catch (e) {
    throw new NetworkError(
      `Can’t reach the KROEX server at ${baseUrl}. Check your connection and ` +
        `that the server is running and reachable from this device.`,
    )
  }

  if (!res.ok || !res.body) throw new Error('Stream failed')

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      if (line.startsWith('data: ') && !line.includes('[DONE]')) {
        yield line.slice(6)
      }
    }
  }
}
