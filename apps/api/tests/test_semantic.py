"""
PostgreSQL integration tests for semantic retrieval.

Proves that:
1. Memories with relevant content rank higher than irrelevant ones via cosine similarity.
2. Document chunks are retrieved by similarity when embeddings are stored.
3. Fallback to recency ordering when no embeddings exist.

Run with:
  pytest -c pytest_pg.ini tests/test_semantic.py -v
"""
import os
import uuid
import asyncio
import pytest
import pytest_asyncio

# Skip entire module when no PG URL is configured
PG_URL = os.environ.get(
    'TEST_DATABASE_URL',
    'postgresql+asyncpg://kroex_test:kroex_test@localhost:5432/kroex_test',
)


@pytest_asyncio.fixture
async def pg_engine():
    from sqlalchemy.ext.asyncio import create_async_engine
    from sqlalchemy.pool import NullPool
    engine = create_async_engine(PG_URL, echo=False, future=True, poolclass=NullPool)
    yield engine
    await engine.dispose()


@pytest_asyncio.fixture
async def pg_db(pg_engine):
    """Async session with a rollback after each test."""
    from sqlalchemy.ext.asyncio import AsyncSession
    async with AsyncSession(pg_engine, expire_on_commit=False) as session:
        yield session
        await session.rollback()


async def _truncate(session):
    from sqlalchemy import text
    for t in ('memories', 'document_chunks', 'project_files', 'projects', 'users'):
        await session.execute(text(f'TRUNCATE {t} CASCADE'))
    await session.commit()


async def _create_user(session, email=None):
    from sqlalchemy import text
    uid = str(uuid.uuid4())
    email = email or f'u{uid[:8]}@example.com'
    await session.execute(text(
        "INSERT INTO users (id, email, name, hashed_password, plan) "
        "VALUES (:id, :email, :name, :pw, 'free')"
    ), {'id': uid, 'email': email, 'name': 'Test', 'pw': 'x'})
    await session.commit()
    return uid


async def _insert_memory(session, user_id, content, embedding=None):
    from sqlalchemy import text
    mid = str(uuid.uuid4())
    if embedding is not None:
        vec_str = '[' + ','.join(str(x) for x in embedding) + ']'
        await session.execute(text(
            "INSERT INTO memories (id, user_id, content, source, embedding) "
            "VALUES (:id, :uid, :content, 'manual', CAST(:vec AS vector))"
        ), {'id': mid, 'uid': user_id, 'content': content, 'vec': vec_str})
    else:
        await session.execute(text(
            "INSERT INTO memories (id, user_id, content, source) "
            "VALUES (:id, :uid, :content, 'manual')"
        ), {'id': mid, 'uid': user_id, 'content': content})
    await session.commit()
    return mid


def _make_embedding(dims=1536, bias=0.0):
    """
    Unit vector with a small bias component on the first dimension.
    Two vectors with different biases will have different cosine distances.
    """
    import math
    v = [0.0] * dims
    v[0] = 1.0 + bias
    # Normalise to unit vector
    mag = math.sqrt(sum(x * x for x in v))
    return [x / mag for x in v]


def _orthogonal_embedding(dims=1536):
    """Return a vector orthogonal to the first dimension (cosine dist = 1 from bias vectors)."""
    import math
    v = [0.0] * dims
    v[1] = 1.0
    return v


# ---------------------------------------------------------------------------
# Test: semantic memory ordering
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_memory_semantic_ordering(pg_db):
    """Relevant memory (high cosine similarity) should rank before irrelevant one."""
    await _truncate(pg_db)
    user_id = await _create_user(pg_db)

    # Create two memories:
    #  - 'relevant': embedding very close to query direction (bias=0.0 → unit vec along dim-0)
    #  - 'irrelevant': embedding orthogonal to query direction
    query_embedding = _make_embedding(bias=0.0)
    relevant_emb = _make_embedding(bias=0.001)      # ~identical direction → low cosine dist
    irrelevant_emb = _orthogonal_embedding()         # perpendicular → cosine dist = 1.0

    await _insert_memory(pg_db, user_id, 'relevant content about dogs', embedding=relevant_emb)
    await _insert_memory(pg_db, user_id, 'irrelevant content about astrophysics', embedding=irrelevant_emb)

    # Directly query via cosine similarity (same SQL used by retrieval.py)
    from sqlalchemy import text
    vec_str = '[' + ','.join(str(x) for x in query_embedding) + ']'
    result = await pg_db.execute(text(
        "SELECT content FROM memories "
        "WHERE user_id = :uid AND embedding IS NOT NULL "
        "ORDER BY embedding <=> CAST(:vec AS vector) "
        "LIMIT 5"
    ), {'uid': user_id, 'vec': vec_str})
    rows = [r[0] for r in result.fetchall()]

    assert len(rows) == 2
    assert rows[0] == 'relevant content about dogs', (
        f'Expected relevant memory first, got: {rows}'
    )
    assert rows[1] == 'irrelevant content about astrophysics'


@pytest.mark.asyncio
async def test_memory_recency_fallback(pg_db):
    """When no embeddings exist, search_memories falls back to recency order."""
    await _truncate(pg_db)
    user_id = await _create_user(pg_db)

    # Insert memories WITHOUT embeddings
    await _insert_memory(pg_db, user_id, 'older memory')
    await asyncio.sleep(0.01)  # ensure different created_at
    await _insert_memory(pg_db, user_id, 'newer memory')

    from app.services.retrieval import search_memories
    # Pass empty query string; no OPENAI_API_KEY set so generate_embedding returns None
    contents, method = await search_memories(user_id, 'any query', pg_db, limit=5)

    assert method == 'recency'
    assert len(contents) >= 2
    assert contents[0] == 'newer memory', f'Expected recency order, got: {contents}'


@pytest.mark.asyncio
async def test_memory_search_user_isolation(pg_db):
    """search_memories must not return another user's memories."""
    await _truncate(pg_db)
    user_a = await _create_user(pg_db, 'a@example.com')
    user_b = await _create_user(pg_db, 'b@example.com')

    emb = _make_embedding()
    await _insert_memory(pg_db, user_b, 'secret memory of user B', embedding=emb)

    from app.services.retrieval import search_memories
    contents, _ = await search_memories(user_a, 'any query', pg_db, limit=10)
    assert 'secret memory of user B' not in contents


# ---------------------------------------------------------------------------
# Test: semantic document chunk ordering
# ---------------------------------------------------------------------------

async def _create_project(session, user_id):
    from sqlalchemy import text
    pid = str(uuid.uuid4())
    await session.execute(text(
        "INSERT INTO projects (id, user_id, name) VALUES (:id, :uid, 'Test Project')"
    ), {'id': pid, 'uid': user_id})
    await session.commit()
    return pid


async def _create_file(session, project_id):
    from sqlalchemy import text
    fid = str(uuid.uuid4())
    await session.execute(text(
        "INSERT INTO project_files (id, project_id, name, content_type, size, storage_key) "
        "VALUES (:id, :pid, 'test.txt', 'text/plain', 100, 'test/key')"
    ), {'id': fid, 'pid': project_id})
    await session.commit()
    return fid


async def _insert_chunk(session, file_id, content, embedding=None, idx=0):
    from sqlalchemy import text
    cid = str(uuid.uuid4())
    if embedding is not None:
        vec_str = '[' + ','.join(str(x) for x in embedding) + ']'
        await session.execute(text(
            "INSERT INTO document_chunks (id, file_id, chunk_index, content, embedding) "
            "VALUES (:id, :fid, :idx, :content, CAST(:vec AS vector))"
        ), {'id': cid, 'fid': file_id, 'idx': idx, 'content': content, 'vec': vec_str})
    else:
        await session.execute(text(
            "INSERT INTO document_chunks (id, file_id, chunk_index, content) "
            "VALUES (:id, :fid, :idx, :content)"
        ), {'id': cid, 'fid': file_id, 'idx': idx, 'content': content})
    await session.commit()
    return cid


@pytest.mark.asyncio
async def test_document_chunk_semantic_ordering(pg_db):
    """Relevant document chunk should rank before irrelevant one via cosine similarity."""
    await _truncate(pg_db)
    user_id = await _create_user(pg_db)
    project_id = await _create_project(pg_db, user_id)
    file_id = await _create_file(pg_db, project_id)

    query_embedding = _make_embedding(bias=0.0)
    relevant_emb = _make_embedding(bias=0.001)
    irrelevant_emb = _orthogonal_embedding()

    await _insert_chunk(pg_db, file_id, 'chunk about machine learning', embedding=relevant_emb, idx=0)
    await _insert_chunk(pg_db, file_id, 'chunk about cooking recipes', embedding=irrelevant_emb, idx=1)

    from sqlalchemy import text
    vec_str = '[' + ','.join(str(x) for x in query_embedding) + ']'
    result = await pg_db.execute(text(
        "SELECT dc.content FROM document_chunks dc "
        "JOIN project_files pf ON pf.id = dc.file_id "
        "WHERE pf.project_id = :pid AND dc.embedding IS NOT NULL "
        "ORDER BY dc.embedding <=> CAST(:vec AS vector) "
        "LIMIT 5"
    ), {'pid': project_id, 'vec': vec_str})
    rows = [r[0] for r in result.fetchall()]

    assert len(rows) == 2
    assert rows[0] == 'chunk about machine learning', f'Expected relevant chunk first, got: {rows}'


@pytest.mark.asyncio
async def test_document_chunk_recency_fallback(pg_db):
    """Document chunks without embeddings fall back to recency order."""
    await _truncate(pg_db)
    user_id = await _create_user(pg_db)
    project_id = await _create_project(pg_db, user_id)
    file_id = await _create_file(pg_db, project_id)

    await _insert_chunk(pg_db, file_id, 'older chunk', idx=0)
    await asyncio.sleep(0.01)
    await _insert_chunk(pg_db, file_id, 'newer chunk', idx=1)

    from app.services.retrieval import search_document_chunks
    contents, method = await search_document_chunks(project_id, 'any query', pg_db, limit=5)

    assert method == 'recency'
    assert len(contents) >= 2
    assert contents[0] == 'newer chunk', f'Expected recency order, got: {contents}'


@pytest.mark.asyncio
async def test_document_chunk_project_isolation(pg_db):
    """search_document_chunks must not return another project's chunks."""
    await _truncate(pg_db)
    user_id = await _create_user(pg_db)
    project_a = await _create_project(pg_db, user_id)
    project_b = await _create_project(pg_db, user_id)
    file_b = await _create_file(pg_db, project_b)

    emb = _make_embedding()
    await _insert_chunk(pg_db, file_b, 'secret chunk from project B', embedding=emb)

    from app.services.retrieval import search_document_chunks
    contents, _ = await search_document_chunks(project_a, 'any query', pg_db, limit=10)
    assert 'secret chunk from project B' not in contents


# ---------------------------------------------------------------------------
# Test: vector column type verification
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_embedding_column_is_vector_type(pg_db):
    """Verify that embedding columns have type 'USER-DEFINED' (vector) not text."""
    from sqlalchemy import text
    result = await pg_db.execute(text(
        "SELECT column_name, data_type, udt_name "
        "FROM information_schema.columns "
        "WHERE table_name IN ('memories', 'document_chunks') "
        "AND column_name = 'embedding'"
    ))
    rows = result.fetchall()
    assert len(rows) == 2, f'Expected 2 embedding columns, found {len(rows)}'
    for col_name, data_type, udt_name in rows:
        assert udt_name == 'vector', (
            f'Expected vector type for {col_name}, got udt_name={udt_name!r} data_type={data_type!r}'
        )
