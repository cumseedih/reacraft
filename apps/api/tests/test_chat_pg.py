"""
Phase 3.3 — chat persistence and security tests against PostgreSQL.

Covers:
- Authentication required for chat, conversation list, and message list endpoints
- Conversation creation via /api/chat/stream
- User message persistence to PostgreSQL
- Assistant message persistence via patched AsyncSessionLocal
- Conversation ownership and isolation between users
- Invalid conversation_id returns 404
- GET /conversations lists user's conversations
- GET /conversations/{id}/messages returns messages in chronological order
- Memory search via HTTP

Run with:
  pytest -c pytest_pg.ini tests/test_chat_pg.py -v
"""
import os
import uuid
import pytest
import pytest_asyncio
from unittest.mock import patch
import sqlalchemy as sa
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from httpx import AsyncClient, ASGITransport

PG_URL = os.environ.get(
    'PG_TEST_URL',
    'postgresql+asyncpg://kroex_test:kroex_test@localhost:5432/kroex_test',
)

pytestmark = pytest.mark.skipif(
    not PG_URL.startswith('postgresql'),
    reason='PostgreSQL not configured',
)

_TRUNCATE = sa.text(
    'TRUNCATE TABLE artifacts, memories, document_chunks, project_files, '
    'messages, conversations, projects, users RESTART IDENTITY CASCADE'
)


async def _mock_stream_chat(*args, **kwargs):
    """Minimal async generator: one delta + done event, no AI provider calls."""
    yield 'data: {"type": "delta", "text": "Hello from mock"}\n\n'
    yield 'data: {"type": "done", "model": "kroex-pro", "usage": {"input": 3, "output": 3}}\n\n'


@pytest_asyncio.fixture
async def pg_client():
    """
    PG client that patches both get_db and app.database.AsyncSessionLocal.
    This ensures both the HTTP layer (get_db) and the streaming generator
    (which opens its own session via AsyncSessionLocal) use the same PG engine.
    """
    os.environ['DATABASE_URL'] = PG_URL
    os.environ.setdefault('JWT_SECRET', 'pg-test-secret-not-for-production')
    os.environ.setdefault('UPLOAD_DIR', '/tmp/kroex_pg_test_uploads')

    eng = create_async_engine(PG_URL, echo=False, future=True, pool_size=2)

    async with eng.begin() as conn:
        await conn.execute(_TRUNCATE)

    from app.config import get_settings
    get_settings.cache_clear()

    from app.main import app
    from app.database import get_db
    import app.database as db_module

    Session = async_sessionmaker(eng, class_=AsyncSession, expire_on_commit=False)

    async def override_get_db():
        async with Session() as session:
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise

    app.dependency_overrides[get_db] = override_get_db

    # Patch the module-level AsyncSessionLocal so streaming generators use PG.
    # This is required because the streaming generator does:
    #   from ..database import AsyncSessionLocal
    # at runtime — which reads the module attribute, so patching the attribute works.
    orig_session_local = db_module.AsyncSessionLocal
    db_module.AsyncSessionLocal = Session

    # Clear accumulated rate-limit state so shared in-memory store doesn't trigger 429.
    from app.middleware.rate_limit import RateLimitMiddleware
    stack = getattr(app, 'middleware_stack', None)
    while stack is not None:
        if isinstance(stack, RateLimitMiddleware):
            stack._store.clear()
            break
        stack = getattr(stack, 'app', None)

    async with AsyncClient(transport=ASGITransport(app=app), base_url='http://test') as ac:
        yield ac

    app.dependency_overrides.clear()
    db_module.AsyncSessionLocal = orig_session_local
    await eng.dispose()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _email(prefix: str = 'chat') -> str:
    return f'{prefix}_{uuid.uuid4().hex[:8]}@example.com'


async def _register(client, email=None, password='PgTest1!', name='User') -> dict:
    if email is None:
        email = _email()
    resp = await client.post('/api/auth/register', json={
        'email': email, 'password': password, 'name': name,
    })
    assert resp.status_code == 201, f'Register failed: {resp.text}'
    return resp.json()


async def _headers(client) -> dict:
    data = await _register(client)
    return {'Authorization': f'Bearer {data["token"]}'}


async def _stream_message(client, headers, message='Hello', conversation_id=None):
    """POST to /api/chat/stream with mocked stream_chat. Returns response."""
    payload = {'message': message, 'messages': [], 'model': 'kroex-pro'}
    if conversation_id:
        payload['conversation_id'] = conversation_id
    with patch('app.routers.chat.stream_chat', new=_mock_stream_chat):
        resp = await client.post('/api/chat/stream', json=payload, headers=headers)
    return resp


# ---------------------------------------------------------------------------
# Authentication requirements
# ---------------------------------------------------------------------------

async def test_chat_requires_auth(pg_client):
    """POST /api/chat/stream without token returns 401."""
    resp = await pg_client.post('/api/chat/stream', json={
        'message': 'hi', 'messages': [], 'model': 'kroex-pro',
    })
    assert resp.status_code == 401


async def test_conversations_list_requires_auth(pg_client):
    """GET /api/conversations without token returns 401."""
    resp = await pg_client.get('/api/conversations')
    assert resp.status_code == 401


async def test_messages_list_requires_auth(pg_client):
    """GET /api/conversations/{id}/messages without token returns 401."""
    fake_id = str(uuid.uuid4())
    resp = await pg_client.get(f'/api/conversations/{fake_id}/messages')
    assert resp.status_code == 401


# ---------------------------------------------------------------------------
# Conversation creation and X-Conversation-Id header
# ---------------------------------------------------------------------------

async def test_chat_creates_conversation(pg_client):
    """Streaming a message creates a conversation; response includes X-Conversation-Id."""
    headers = await _headers(pg_client)
    resp = await _stream_message(pg_client, headers)
    assert resp.status_code == 200, resp.text
    conv_id = resp.headers.get('x-conversation-id')
    assert conv_id, f'X-Conversation-Id header missing; headers: {dict(resp.headers)}'

    list_resp = await pg_client.get('/api/conversations', headers=headers)
    assert list_resp.status_code == 200
    ids = [c['id'] for c in list_resp.json()]
    assert conv_id in ids, f'Conversation {conv_id} not found in list: {ids}'


# ---------------------------------------------------------------------------
# Message persistence
# ---------------------------------------------------------------------------

async def test_chat_user_message_persisted(pg_client):
    """User message is committed to PG and readable via GET /messages."""
    headers = await _headers(pg_client)
    resp = await _stream_message(pg_client, headers, message='Remember this')
    assert resp.status_code == 200
    conv_id = resp.headers.get('x-conversation-id')
    assert conv_id

    msgs_resp = await pg_client.get(
        f'/api/conversations/{conv_id}/messages', headers=headers
    )
    assert msgs_resp.status_code == 200
    messages = msgs_resp.json()
    user_msgs = [m for m in messages if m['role'] == 'user']
    assert user_msgs, f'No user messages found: {messages}'
    assert user_msgs[0]['content'] == 'Remember this'


async def test_chat_assistant_message_persisted(pg_client):
    """
    Assistant message from the streaming generator is persisted to PG.
    This test proves the fix for the FK ordering issue: conversation is now
    committed before streaming starts, so the generator's separate session
    can safely insert the assistant message.
    """
    headers = await _headers(pg_client)
    resp = await _stream_message(pg_client, headers, message='Ping')
    assert resp.status_code == 200
    conv_id = resp.headers.get('x-conversation-id')
    assert conv_id

    msgs_resp = await pg_client.get(
        f'/api/conversations/{conv_id}/messages', headers=headers
    )
    assert msgs_resp.status_code == 200
    messages = msgs_resp.json()
    assistant_msgs = [m for m in messages if m['role'] == 'assistant']
    assert assistant_msgs, f'No assistant messages found: {messages}'
    assert 'Hello from mock' in assistant_msgs[0]['content']


async def test_chat_subsequent_turn_continues_conversation(pg_client):
    """Second message in same conversation appends; both user messages are readable."""
    headers = await _headers(pg_client)

    resp1 = await _stream_message(pg_client, headers, message='First turn')
    assert resp1.status_code == 200
    conv_id = resp1.headers.get('x-conversation-id')

    resp2 = await _stream_message(
        pg_client, headers, message='Second turn', conversation_id=conv_id
    )
    assert resp2.status_code == 200

    msgs_resp = await pg_client.get(
        f'/api/conversations/{conv_id}/messages', headers=headers
    )
    messages = msgs_resp.json()
    user_contents = [m['content'] for m in messages if m['role'] == 'user']
    assert 'First turn' in user_contents
    assert 'Second turn' in user_contents


async def test_chat_messages_returned_oldest_first(pg_client):
    """Messages endpoint returns messages in chronological order (oldest first)."""
    headers = await _headers(pg_client)

    resp1 = await _stream_message(pg_client, headers, message='Alpha')
    conv_id = resp1.headers.get('x-conversation-id')

    resp2 = await _stream_message(
        pg_client, headers, message='Beta', conversation_id=conv_id
    )
    assert resp2.status_code == 200

    msgs_resp = await pg_client.get(
        f'/api/conversations/{conv_id}/messages', headers=headers
    )
    messages = msgs_resp.json()
    user_contents = [m['content'] for m in messages if m['role'] == 'user']
    assert user_contents[0] == 'Alpha', f'Expected Alpha first, got: {user_contents}'
    assert user_contents[1] == 'Beta'


# ---------------------------------------------------------------------------
# Conversation isolation and ownership
# ---------------------------------------------------------------------------

async def test_chat_conversation_not_visible_to_other_user(pg_client):
    """User B cannot list User A's conversations."""
    h_a = await _headers(pg_client)
    h_b = await _headers(pg_client)

    resp = await _stream_message(pg_client, h_a, message='Private')
    assert resp.status_code == 200
    conv_id = resp.headers.get('x-conversation-id')

    list_resp = await pg_client.get('/api/conversations', headers=h_b)
    assert list_resp.status_code == 200
    b_ids = [c['id'] for c in list_resp.json()]
    assert conv_id not in b_ids, f'User B can see User A conversation {conv_id}'


async def test_chat_messages_not_visible_to_other_user(pg_client):
    """User B cannot fetch messages from User A's conversation (404)."""
    h_a = await _headers(pg_client)
    h_b = await _headers(pg_client)

    resp = await _stream_message(pg_client, h_a, message='Secret')
    conv_id = resp.headers.get('x-conversation-id')

    msgs_resp = await pg_client.get(
        f'/api/conversations/{conv_id}/messages', headers=h_b
    )
    assert msgs_resp.status_code == 404, (
        f'Expected 404, got {msgs_resp.status_code}: {msgs_resp.text}'
    )


async def test_chat_nonexistent_conversation_returns_404(pg_client):
    """POST to a nonexistent conversation_id returns 404."""
    headers = await _headers(pg_client)
    fake_id = str(uuid.uuid4())
    with patch('app.routers.chat.stream_chat', new=_mock_stream_chat):
        resp = await pg_client.post('/api/chat/stream', json={
            'message': 'hi',
            'messages': [],
            'model': 'kroex-pro',
            'conversation_id': fake_id,
        }, headers=headers)
    assert resp.status_code == 404, (
        f'Expected 404, got {resp.status_code}: {resp.text}'
    )


# ---------------------------------------------------------------------------
# Memory search via HTTP
# ---------------------------------------------------------------------------

async def test_memory_search_via_http(pg_client):
    """GET /api/memory/search returns contents list and method field."""
    headers = await _headers(pg_client)

    mem_resp = await pg_client.post(
        '/api/memory', json={'content': 'I like Python'}, headers=headers
    )
    assert mem_resp.status_code == 201

    search_resp = await pg_client.get('/api/memory/search?q=Python', headers=headers)
    assert search_resp.status_code == 200
    data = search_resp.json()
    assert 'contents' in data, f'Missing contents field: {data}'
    assert 'method' in data, f'Missing method field: {data}'
    assert isinstance(data['contents'], list)
    assert data['method'] in ('semantic', 'recency')
    assert 'I like Python' in data['contents']


async def test_memory_search_requires_auth(pg_client):
    """Memory search without auth returns 401."""
    resp = await pg_client.get('/api/memory/search?q=test')
    assert resp.status_code == 401


# ---------------------------------------------------------------------------
# Production config security validation
# ---------------------------------------------------------------------------

def test_production_rejects_dev_jwt_secret():
    """Settings with environment=production and default jwt_secret raise ValueError."""
    import pytest
    from app.config import Settings
    with pytest.raises(ValueError, match='JWT_SECRET'):
        Settings(
            environment='production',
            jwt_secret='change-me-in-production',
            database_url='postgresql+asyncpg://u:strongpass@localhost:5432/db',
        )


def test_production_rejects_dev_database_url():
    """Settings with environment=production and dev DB password raise ValueError."""
    import pytest
    from app.config import Settings
    with pytest.raises(ValueError, match='DATABASE_URL'):
        Settings(
            environment='production',
            jwt_secret='a-strong-secret-at-least-32-chars-long',
            database_url='postgresql+asyncpg://kroex:kroex_dev_only@localhost:5432/kroex',
        )


def test_valid_production_config_passes():
    """Settings with strong secrets and production environment must not raise."""
    from app.config import Settings
    s = Settings(
        environment='production',
        jwt_secret='a-strong-unique-secret-that-is-definitely-not-the-default',
        database_url='postgresql+asyncpg://kroex:StrongProductionPass@db:5432/kroex',
    )
    assert s.environment == 'production'
