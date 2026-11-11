import { NextRequest } from 'next/server'

/**
 * Catch-all server-side proxy: browser -> Next server -> KROEX API.
 *
 * Why this exists: the staging API binds to the VPS loopback
 * (127.0.0.1:8000) and reaching it requires an SSH tunnel on the machine
 * running this Next server. The browser cannot reach it directly, and no
 * CORS/firewall change is permitted. STAGING_CONFIG.md's guidance is
 * therefore: "browser apps should call the API through their server-side
 * proxy route (Next BACKEND_URL)". This route is that path, generalized
 * from the pre-existing single-purpose /api/chat/stream proxy.
 *
 * The static route /api/chat/stream takes precedence over this dynamic
 * catch-all in Next's router, so that existing proxy keeps working as-is.
 *
 * Contract fidelity (API Integration Specification):
 *  - Status codes pass through untouched — 404 is overloaded by design
 *    (§5.3), 422 carries an array detail (§5.1), 429 carries Retry-After
 *    (§5.4). The client must see all of these verbatim.
 *  - X-Conversation-Id / X-Run-Id are re-exposed, since stream IDs arrive
 *    as response headers, not stream events (§9.3).
 *  - Bodies stream through untouched, so both SSE dialects (§2.1-§2.4)
 *    work without the proxy understanding either of them.
 */

const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:8000'

export const dynamic = 'force-dynamic'

/** Headers we must not copy upstream (hop-by-hop / recomputed by fetch). */
const STRIPPED_REQUEST_HEADERS = new Set([
  'host', 'connection', 'keep-alive', 'transfer-encoding', 'upgrade',
  'proxy-authorization', 'proxy-authenticate', 'te', 'trailer', 'content-length',
])

/** Upstream headers worth surfacing to the browser. */
const FORWARDED_RESPONSE_HEADERS = [
  'content-type',
  'cache-control',
  'retry-after',
  'x-conversation-id',
  'x-run-id',
  'x-accel-buffering',
]

async function proxy(req: NextRequest, path: string[]): Promise<Response> {
  const search = req.nextUrl.search
  const target = `${BACKEND_URL}/api/${path.join('/')}${search}`

  const headers = new Headers()
  req.headers.forEach((value, key) => {
    if (!STRIPPED_REQUEST_HEADERS.has(key.toLowerCase())) headers.set(key, value)
  })

  const hasBody = req.method !== 'GET' && req.method !== 'HEAD'

  let upstream: Response
  try {
    upstream = await fetch(target, {
      method: req.method,
      headers,
      body: hasBody ? await req.arrayBuffer() : undefined,
      redirect: 'manual',
      // Required by undici when streaming a request body; harmless otherwise.
      ...(hasBody ? { duplex: 'half' } : {}),
    } as RequestInit)
  } catch {
    // The API was unreachable (tunnel down, backend stopped). Report it as a
    // gateway error with the same {detail: string} shape the API itself uses,
    // so clients have exactly one error contract to handle.
    return Response.json(
      { detail: 'Cannot reach the KROEX API from the server. Check the backend/tunnel.' },
      { status: 502 },
    )
  }

  const responseHeaders = new Headers()
  for (const name of FORWARDED_RESPONSE_HEADERS) {
    const value = upstream.headers.get(name)
    if (value) responseHeaders.set(name, value)
  }

  // 204/304 must not carry a body.
  if (upstream.status === 204 || upstream.status === 304) {
    return new Response(null, { status: upstream.status, headers: responseHeaders })
  }

  return new Response(upstream.body, { status: upstream.status, headers: responseHeaders })
}

type Ctx = { params: Promise<{ path: string[] }> }

export async function GET(req: NextRequest, ctx: Ctx) {
  return proxy(req, (await ctx.params).path)
}
export async function POST(req: NextRequest, ctx: Ctx) {
  return proxy(req, (await ctx.params).path)
}
export async function PUT(req: NextRequest, ctx: Ctx) {
  return proxy(req, (await ctx.params).path)
}
export async function PATCH(req: NextRequest, ctx: Ctx) {
  return proxy(req, (await ctx.params).path)
}
export async function DELETE(req: NextRequest, ctx: Ctx) {
  return proxy(req, (await ctx.params).path)
}
