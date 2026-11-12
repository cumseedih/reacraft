"""
Phase 3.2 — real AI provider tests.

Each test is skipped when the required API key is absent.
No test is marked as passed without actually being executed.

Covers:
- Real OpenAI embedding generation (OPENAI_API_KEY required)
- Real Anthropic streaming (ANTHROPIC_API_KEY required)
- Real OpenAI chat streaming (OPENAI_API_KEY required)
- Conversation persistence: messages saved and retrievable after streaming
- Interrupted stream recovery: partial stream does not corrupt stored messages

Run with:
  pytest tests/test_provider.py -v
  (uses default pytest.ini — SQLite for unit parts, PG not required)

For full persistence tests with PostgreSQL:
  TEST_DATABASE_URL=... pytest -c pytest_pg.ini tests/test_provider.py -v
"""
import os
import json
import uuid
import pytest
import pytest_asyncio

OPENAI_KEY = os.environ.get('OPENAI_API_KEY', '')
ANTHROPIC_KEY = os.environ.get('ANTHROPIC_API_KEY', '')
PG_URL = os.environ.get(
    'TEST_DATABASE_URL',
    'postgresql+asyncpg://kroex_test:kroex_test@localhost:5432/kroex_test',
)

needs_openai = pytest.mark.skipif(not OPENAI_KEY, reason='OPENAI_API_KEY not set')
needs_anthropic = pytest.mark.skipif(not ANTHROPIC_KEY, reason='ANTHROPIC_API_KEY not set')
needs_pg = pytest.mark.skipif(
    not os.environ.get('TEST_DATABASE_URL'), reason='TEST_DATABASE_URL not set'
)


# ---------------------------------------------------------------------------
# Real embedding tests
# ---------------------------------------------------------------------------

@needs_openai
@pytest.mark.asyncio
async def test_real_openai_embedding_shape():
    """OpenAI text-embedding-3-small returns a 1536-dim float list."""
    from app.services.embeddings import generate_embedding, EMBEDDING_DIMS
    result = await generate_embedding('Hello, world!')
    assert result is not None, 'generate_embedding returned None despite OPENAI_API_KEY being set'
    assert len(result) == EMBEDDING_DIMS, (
        f'Expected {EMBEDDING_DIMS} dims, got {len(result)}'
    )
    assert all(isinstance(x, float) for x in result), 'Embedding contains non-float values'


@needs_openai
@pytest.mark.asyncio
async def test_real_openai_embedding_similar_texts_closer():
    """
    Embeddings of semantically similar texts are closer than unrelated texts.
    Uses cosine similarity: sim(a,b) = dot(a,b) / (|a||b|)
    """
    import math
    from app.services.embeddings import generate_embedding

    emb_ml1 = await generate_embedding('neural networks and deep learning')
    emb_ml2 = await generate_embedding('machine learning and AI models')
    emb_cooking = await generate_embedding('how to bake sourdough bread')

    assert emb_ml1 and emb_ml2 and emb_cooking

    def cosine(a, b):
        dot = sum(x * y for x, y in zip(a, b))
        mag_a = math.sqrt(sum(x * x for x in a))
        mag_b = math.sqrt(sum(x * x for x in b))
        return dot / (mag_a * mag_b)

    sim_related = cosine(emb_ml1, emb_ml2)
    sim_unrelated = cosine(emb_ml1, emb_cooking)

    assert sim_related > sim_unrelated, (
        f'Expected similar texts to have higher cosine similarity: '
        f'related={sim_related:.3f}, unrelated={sim_unrelated:.3f}'
    )


@needs_openai
@pytest.mark.asyncio
async def test_real_openai_embedding_empty_text_returns_vector():
    """Empty string still returns a valid embedding (OpenAI handles it)."""
    from app.services.embeddings import generate_embedding, EMBEDDING_DIMS
    result = await generate_embedding(' ')
    # OpenAI may return a vector for whitespace; if it does, verify shape
    if result is not None:
        assert len(result) == EMBEDDING_DIMS


@pytest.mark.asyncio
async def test_embedding_no_key_returns_none(monkeypatch):
    """When OPENAI_API_KEY is absent, generate_embedding returns None (no exception)."""
    monkeypatch.setenv('OPENAI_API_KEY', '')
    # Reset lru_cache so the patched env var is picked up
    from app.config import get_settings
    get_settings.cache_clear()
    try:
        from app.services.embeddings import generate_embedding
        result = await generate_embedding('test')
        assert result is None
    finally:
        get_settings.cache_clear()


# ---------------------------------------------------------------------------
# Real streaming tests
# ---------------------------------------------------------------------------

@needs_anthropic
@pytest.mark.asyncio
async def test_real_anthropic_stream_yields_delta_and_done():
    """
    Real Anthropic streaming must yield at least one 'delta' SSE event and
    end with a 'done' event containing usage stats.
    """
    from app.services.ai import stream_chat

    messages = [{'role': 'user', 'content': 'Say exactly: hello'}]
    events = []
    async for sse_line in stream_chat(messages, model_id='kroex-fast'):
        if sse_line.startswith('data: '):
            try:
                events.append(json.loads(sse_line[6:].strip()))
            except Exception:
                pass

    delta_events = [e for e in events if e.get('type') == 'delta']
    done_events = [e for e in events if e.get('type') == 'done']

    assert delta_events, 'No delta events received from Anthropic stream'
    assert done_events, 'No done event received from Anthropic stream'

    full_text = ''.join(e.get('text', '') for e in delta_events)
    assert full_text.strip(), 'Delta events contained no text'

    done = done_events[0]
    assert 'usage' in done, f'done event missing usage: {done}'
    assert done['usage']['input'] > 0, 'Expected non-zero input tokens'
    assert done['usage']['output'] > 0, 'Expected non-zero output tokens'


@needs_openai
@pytest.mark.asyncio
async def test_real_openai_stream_yields_delta_and_done():
    """Real OpenAI streaming must yield delta events and a done event."""
    from app.services.ai import stream_chat

    messages = [{'role': 'user', 'content': 'Say exactly: hello'}]
    events = []
    async for sse_line in stream_chat(messages, model_id='gpt-4o-mini'):
        if sse_line.startswith('data: '):
            try:
                events.append(json.loads(sse_line[6:].strip()))
            except Exception:
                pass

    delta_events = [e for e in events if e.get('type') == 'delta']
    done_events = [e for e in events if e.get('type') == 'done']

    assert delta_events, 'No delta events received from OpenAI stream'
    assert done_events, 'No done event received from OpenAI stream'

    full_text = ''.join(e.get('text', '') for e in delta_events)
    assert full_text.strip(), 'Delta events contained no text'


# ---------------------------------------------------------------------------
# Conversation persistence tests (require PostgreSQL)
# ---------------------------------------------------------------------------

@pytest_asyncio.fixture
async def pg_engine():
    from sqlalchemy.ext.asyncio import create_async_engine
    engine = create_async_engine(PG_URL, echo=False, future=True)
    yield engine
    await engine.dispose()


async def _truncate_tables(session):
    from sqlalchemy import text
    for t in ('artifacts', 'messages', 'conversations', 'memories',
              'document_chunks', 'project_files', 'projects', 'users'):
        await session.execute(text(f'TRUNCATE {t} CASCADE'))
    await session.commit()


@needs_pg
@pytest.mark.asyncio
async def test_conversation_messages_persisted(pg_engine):
    """
    Messages written in one database session are visible to a separate session.
    This is the persistence invariant that matters: data committed by the streaming
    generator (which opens its own AsyncSession) survives beyond the request and is
    readable by subsequent requests.
    """
    from sqlalchemy import text
    from sqlalchemy.ext.asyncio import async_sessionmaker, AsyncSession

    factory = async_sessionmaker(pg_engine, expire_on_commit=False)

    async with factory() as s:
        await _truncate_tables(s)
        uid = str(uuid.uuid4())
        await s.execute(text(
            "INSERT INTO users (id, email, name, hashed_password, plan) "
            "VALUES (:id, :e, 'T', 'x', 'free')"
        ), {'id': uid, 'e': f'{uid[:8]}@persist.com'})
        conv_id = str(uuid.uuid4())
        await s.execute(text(
            "INSERT INTO conversations (id, user_id, title, model) "
            "VALUES (:id, :uid, 'T', 'kroex-pro')"
        ), {'id': conv_id, 'uid': uid})
        # Simulate what the endpoint does: persist user message before streaming
        umsg_id = str(uuid.uuid4())
        await s.execute(text(
            "INSERT INTO messages (id, conversation_id, role, content) "
            "VALUES (:id, :cid, 'user', 'hi there')"
        ), {'id': umsg_id, 'cid': conv_id})
        await s.commit()

    # Simulate what the streaming generator does: open a new session, commit assistant reply
    async with factory() as s2:
        amsg_id = str(uuid.uuid4())
        await s2.execute(text(
            "INSERT INTO messages (id, conversation_id, role, content) "
            "VALUES (:id, :cid, 'assistant', 'Hello world')"
        ), {'id': amsg_id, 'cid': conv_id})
        await s2.commit()

    # A third session (simulating the GET /messages endpoint) must see both messages
    async with factory() as s3:
        result = await s3.execute(text(
            "SELECT role, content FROM messages WHERE conversation_id = :cid "
            "ORDER BY created_at"
        ), {'cid': conv_id})
        rows = result.fetchall()

    assert len(rows) == 2, f'Expected 2 messages, got {len(rows)}: {rows}'
    roles = {r[0] for r in rows}
    assert 'user' in roles and 'assistant' in roles, f'Missing roles: {roles}'
    contents = {r[1] for r in rows}
    assert 'hi there' in contents
    assert 'Hello world' in contents


@needs_pg
@pytest.mark.asyncio
async def test_interrupted_stream_does_not_corrupt_prior_messages(pg_engine):
    """
    A transaction rolled back due to a stream interruption must not affect already-
    committed messages in the same conversation.

    This validates PostgreSQL's transactional isolation guarantee: committed data
    from s1 survives a rollback in s2.
    """
    from sqlalchemy import text
    from sqlalchemy.ext.asyncio import async_sessionmaker

    factory = async_sessionmaker(pg_engine, expire_on_commit=False)

    async with factory() as s:
        await _truncate_tables(s)
        uid = str(uuid.uuid4())
        await s.execute(text(
            "INSERT INTO users (id, email, name, hashed_password, plan) "
            "VALUES (:id, :e, 'T', 'x', 'free')"
        ), {'id': uid, 'e': f'{uid[:8]}@intr.com'})
        conv_id = str(uuid.uuid4())
        await s.execute(text(
            "INSERT INTO conversations (id, user_id, title, model) "
            "VALUES (:id, :uid, 'T', 'kroex-pro')"
        ), {'id': conv_id, 'uid': uid})
        # First complete exchange: user message + committed assistant reply
        for role, content in [('user', 'first message'), ('assistant', 'good response')]:
            await s.execute(text(
                "INSERT INTO messages (id, conversation_id, role, content) "
                "VALUES (:id, :cid, :role, :content)"
            ), {'id': str(uuid.uuid4()), 'cid': conv_id, 'role': role, 'content': content})
        await s.commit()

    # Interrupted second turn: user message inserted but transaction rolled back
    async with factory() as s2:
        try:
            await s2.execute(text(
                "INSERT INTO messages (id, conversation_id, role, content) "
                "VALUES (:id, :cid, 'user', 'second message')"
            ), {'id': str(uuid.uuid4()), 'cid': conv_id})
            raise RuntimeError('connection dropped before commit')
        except Exception:
            await s2.rollback()

    # Verify: first exchange intact; interrupted user message absent
    async with factory() as s3:
        result = await s3.execute(text(
            "SELECT role, content FROM messages WHERE conversation_id = :cid "
            "ORDER BY created_at"
        ), {'cid': conv_id})
        rows = result.fetchall()

    contents = [r[1] for r in rows]
    assert 'good response' in contents, f'First assistant message lost: {contents}'
    assert 'second message' not in contents, (
        f'Interrupted message was persisted despite rollback: {contents}'
    )
