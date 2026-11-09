import { NextRequest } from 'next/server'

const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:8000'

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const body = await req.text()

  const upstream = await fetch(`${BACKEND_URL}/api/chat/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(authHeader ? { Authorization: authHeader } : {}),
    },
    body,
  })

  if (!upstream.ok) {
    const err = await upstream.text()
    return new Response(err, { status: upstream.status })
  }

  const convId = upstream.headers.get('x-conversation-id')
  return new Response(upstream.body, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'X-Accel-Buffering': 'no',
      ...(convId ? { 'X-Conversation-Id': convId } : {}),
    },
  })
}
