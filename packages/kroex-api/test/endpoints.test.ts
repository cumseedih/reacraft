import { describe, expect, it, vi } from 'vitest'
import { createKroexClient, uploadProjectFile } from '../src/client/endpoints'
import { KroexApiError } from '../src/errors'
import type { KroexClientConfig } from '../src/client/types'

/** Records the last fetch call so tests can assert method/url/body/headers. */
function recordingClient(response: () => Response) {
  const calls: Array<{ url: string; init: RequestInit }> = []
  const fetchImpl = vi.fn(async (url: string | URL, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} })
    return response()
  }) as unknown as typeof fetch
  const config: KroexClientConfig = {
    baseUrl: 'https://staging.local/',
    getToken: () => 'jwt-abc',
    fetchImpl,
  }
  return { client: createKroexClient(config), config, calls }
}

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(body === undefined ? null : JSON.stringify(body), { status, headers })

describe('createKroexClient — request shaping', () => {
  it('builds correct method + path + auth header for a GET', async () => {
    const { client, calls } = recordingClient(() => json([{ id: 'c1' }]))
    await client.chat.listConversations()
    expect(calls[0]!.url).toBe('https://staging.local/api/conversations')
    expect(calls[0]!.init.method).toBe('GET')
    expect(new Headers(calls[0]!.init.headers).get('Authorization')).toBe('Bearer jwt-abc')
  })

  it('JSON-encodes a POST body (auth.register)', async () => {
    const { client, calls } = recordingClient(() => json({ user: {}, token: 't' }, 201))
    await client.auth.register({ name: 'A', email: 'a@b.com', password: 'longenough' })
    expect(calls[0]!.init.method).toBe('POST')
    expect(JSON.parse(calls[0]!.init.body as string)).toEqual({ name: 'A', email: 'a@b.com', password: 'longenough' })
  })

  it('encodes query params for memory.search (q + limit)', async () => {
    const { client, calls } = recordingClient(() => json({ contents: [], method: 'recency' }))
    await client.memory.search('hello', 5)
    expect(calls[0]!.url).toBe('https://staging.local/api/memory/search?q=hello&limit=5')
  })

  it('omits undefined query params (listSessions with no workspace filter)', async () => {
    const { client, calls } = recordingClient(() => json([]))
    await client.sandbox.listSessions()
    expect(calls[0]!.url).toBe('https://staging.local/api/sandbox/sessions')
  })

  it('sends an empty object body for stopSession when none provided (router accepts empty body)', async () => {
    const { client, calls } = recordingClient(() => json({ session_id: 's1', status: 'stopping' }, 202))
    await client.sandbox.stopSession('s1')
    expect(JSON.parse(calls[0]!.init.body as string)).toEqual({})
  })
})

describe('createKroexClient — contract behaviours (spec §5)', () => {
  it('returns parsed JSON on success (sandbox.getConfig)', async () => {
    const cfg = { images: ['python', 'node', 'full'], default_image: 'python', runtime: 'runsc', limits: {} }
    const { client } = recordingClient(() => json(cfg))
    await expect(client.sandbox.getConfig()).resolves.toEqual(cfg)
  })

  it('resolves void for a 204 delete (projects.remove)', async () => {
    const { client } = recordingClient(() => new Response(null, { status: 204 }))
    await expect(client.projects.remove('p1')).resolves.toBeUndefined()
  })

  it('surfaces a flag-off 404 as KroexApiError (bot disabled -> 404 "Not found", §5.3)', async () => {
    const { client } = recordingClient(() => json({ detail: 'Not found' }, 404))
    const err = await client.bot.getConversation().catch((e) => e)
    expect(err).toBeInstanceOf(KroexApiError)
    expect((err as KroexApiError).isNotFoundOrUnavailable).toBe(true)
  })

  it('surfaces a 422 validation array (agents.create unknown model)', async () => {
    const { client } = recordingClient(() =>
      json({ detail: [{ loc: ['body', 'model'], msg: 'Unknown model: x', type: 'value_error' }] }, 422),
    )
    const err = await client.agents.create({ name: 'A', model: 'x' }).catch((e) => e)
    expect((err as KroexApiError).isValidationError).toBe(true)
  })

  it('captures Retry-After on a 429 (sandbox surface bucket, §5.4)', async () => {
    const { client } = recordingClient(() =>
      json({ detail: 'Rate limit exceeded for sandbox; try again shortly.' }, 429, { 'Retry-After': '30' }),
    )
    const err = await client.sandbox.createWorkspace({ name: 'w' }).catch((e) => e)
    expect((err as KroexApiError).retryAfterSeconds).toBe(30)
  })

  it('returns a 202 async body for agents.run (enqueue-only)', async () => {
    const run = { id: 'r1', agent_id: 'a1', status: 'queued' }
    const { client } = recordingClient(() => json(run, 202))
    await expect(client.agents.run('a1', { prompt: 'go' })).resolves.toMatchObject({ status: 'queued' })
  })
})

describe('uploadProjectFile — multipart (spec §1.4)', () => {
  it('posts FormData without a JSON Content-Type and returns FileOut', async () => {
    let captured: RequestInit | undefined
    const fetchImpl = vi.fn(async (_url: string | URL, init?: RequestInit) => {
      captured = init
      return json({ id: 'f1', name: 'x.txt', content_type: 'text/plain', size: 3, chunk_count: 0, created_at: 't' }, 201)
    }) as unknown as typeof fetch
    const config: KroexClientConfig = { baseUrl: 'https://staging.local', getToken: () => 'jwt-abc', fetchImpl }

    const form = new FormData()
    form.append('file', new Blob(['abc'], { type: 'text/plain' }), 'x.txt')
    const result = await uploadProjectFile(config, 'p1', form)

    expect(result).toMatchObject({ id: 'f1', chunk_count: 0 })
    // Content-Type must NOT be forced (platform sets the multipart boundary).
    expect(new Headers(captured?.headers).has('Content-Type')).toBe(false)
    expect(new Headers(captured?.headers).get('Authorization')).toBe('Bearer jwt-abc')
  })

  it('throws KroexApiError on a 413 over-size upload', async () => {
    const fetchImpl = vi.fn(async () => json({ detail: 'File exceeds 50MB limit' }, 413)) as unknown as typeof fetch
    const config: KroexClientConfig = { baseUrl: 'https://staging.local', getToken: () => null, fetchImpl }
    const err = await uploadProjectFile(config, 'p1', new FormData()).catch((e) => e)
    expect(err).toBeInstanceOf(KroexApiError)
    expect((err as KroexApiError).status).toBe(413)
  })
})

describe('createKroexClient — surface coverage sanity', () => {
  it('exposes every documented surface group', () => {
    const { client } = recordingClient(() => json({}))
    for (const group of ['auth', 'chat', 'projects', 'memory', 'artifacts', 'bot', 'agents', 'sandbox'] as const) {
      expect(client[group]).toBeDefined()
    }
  })

  it('does NOT expose a code-review surface (disabled on staging, must stay disabled)', () => {
    const { client } = recordingClient(() => json({}))
    expect((client as unknown as Record<string, unknown>).code).toBeUndefined()
  })
})
