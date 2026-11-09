import pytest
import uuid
from unittest.mock import patch, AsyncMock


async def _register_and_token(client) -> str:
    email = f'chat_{uuid.uuid4().hex[:8]}@example.com'
    reg = await client.post('/api/auth/register', json={
        'email': email, 'password': 'Password1!', 'name': 'User',
    })
    return reg.json()['token']


async def _fake_stream(*args, **kwargs):
    """Yield SSE events matching stream_chat() output format."""
    import json
    yield f'data: {json.dumps({"type": "delta", "text": "Hello"})}\n\n'
    yield f'data: {json.dumps({"type": "delta", "text": " world"})}\n\n'
    yield f'data: {json.dumps({"type": "done", "model": "claude-sonnet-4-6", "usage": {"input": 10, "output": 5}})}\n\n'


@pytest.mark.asyncio
async def test_stream_chat(client):
    token = await _register_and_token(client)
    headers = {'Authorization': f'Bearer {token}'}

    with patch('app.routers.chat.stream_chat', side_effect=_fake_stream):
        async with client.stream(
            'POST',
            '/api/chat/stream',
            json={'message': 'Hi', 'model': 'kroex-fast'},
            headers=headers,
        ) as resp:
            assert resp.status_code == 200
            assert 'text/event-stream' in resp.headers.get('content-type', '')

            events = []
            async for line in resp.aiter_lines():
                if line.startswith('data: '):
                    import json
                    events.append(json.loads(line[6:]))

    types = [e['type'] for e in events]
    assert 'delta' in types
    assert 'done' in types
    combined = ''.join(e.get('text', '') for e in events if e['type'] == 'delta')
    assert combined == 'Hello world'
