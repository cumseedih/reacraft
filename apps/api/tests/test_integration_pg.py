"""
PostgreSQL integration tests.

Requires a live PostgreSQL instance with the schema already applied:
  PG_TEST_URL=postgresql+asyncpg://kroex_test:kroex_test@localhost:5432/kroex_test

Skip automatically when PG_TEST_URL is not set or not PostgreSQL.
"""
import os
import uuid
import pytest
import pytest_asyncio
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


@pytest_asyncio.fixture
async def pg_client():
    """Function-scoped fixture: fresh engine + client per test, same event loop."""
    os.environ['DATABASE_URL'] = PG_URL
    os.environ.setdefault('JWT_SECRET', 'pg-test-secret-not-for-production')
    os.environ.setdefault('UPLOAD_DIR', '/tmp/kroex_pg_test_uploads')

    eng = create_async_engine(PG_URL, echo=False, future=True, pool_size=2)

    # Wipe data before each test
    async with eng.begin() as conn:
        await conn.execute(_TRUNCATE)

    from app.config import get_settings
    get_settings.cache_clear()

    from app.main import app
    from app.database import get_db

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

    async with AsyncClient(transport=ASGITransport(app=app), base_url='http://test') as ac:
        yield ac

    app.dependency_overrides.clear()
    await eng.dispose()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _email(prefix: str = 'pg') -> str:
    return f'{prefix}_{uuid.uuid4().hex[:8]}@example.com'


async def _register(client, email=None, password='PgTest1!', name='User') -> dict:
    if email is None:
        email = _email()
    resp = await client.post('/api/auth/register', json={
        'email': email, 'password': password, 'name': name,
    })
    return resp.json()


async def _headers(client) -> dict:
    data = await _register(client)
    return {'Authorization': f'Bearer {data["token"]}'}


# ---------------------------------------------------------------------------
# Auth tests against real PostgreSQL
# ---------------------------------------------------------------------------

async def test_pg_register(pg_client):
    email = _email('reg')
    resp = await pg_client.post('/api/auth/register', json={
        'email': email, 'password': 'PgTest1!', 'name': 'PG User',
    })
    assert resp.status_code == 201, resp.text
    data = resp.json()
    assert 'token' in data
    assert data['user']['email'] == email


async def test_pg_login(pg_client):
    email = _email('login')
    password = 'PgTest1!'
    await _register(pg_client, email=email, password=password)
    resp = await pg_client.post('/api/auth/login', json={'email': email, 'password': password})
    assert resp.status_code == 200, resp.text
    assert 'token' in resp.json()


async def test_pg_duplicate_register(pg_client):
    email = _email('dup')
    payload = {'email': email, 'password': 'PgTest1!', 'name': 'Dup'}
    await pg_client.post('/api/auth/register', json=payload)
    resp = await pg_client.post('/api/auth/register', json=payload)
    assert resp.status_code in (400, 409)


async def test_pg_wrong_password(pg_client):
    email = _email('wrong')
    await _register(pg_client, email=email)
    resp = await pg_client.post('/api/auth/login', json={'email': email, 'password': 'WrongPass1!'})
    assert resp.status_code == 401


async def test_pg_me_authenticated(pg_client):
    data = await _register(pg_client)
    token = data['token']
    resp = await pg_client.get('/api/auth/me', headers={'Authorization': f'Bearer {token}'})
    assert resp.status_code == 200
    assert resp.json()['email'] == data['user']['email']


# ---------------------------------------------------------------------------
# Project CRUD
# ---------------------------------------------------------------------------

async def test_pg_create_project(pg_client):
    headers = await _headers(pg_client)
    resp = await pg_client.post('/api/projects', json={
        'name': 'Test Project', 'description': 'A test project',
    }, headers=headers)
    assert resp.status_code == 201, resp.text
    data = resp.json()
    assert data['name'] == 'Test Project'
    assert 'id' in data


async def test_pg_list_projects(pg_client):
    headers = await _headers(pg_client)
    for i in range(2):
        r = await pg_client.post('/api/projects', json={'name': f'Project {i}'}, headers=headers)
        assert r.status_code == 201, r.text
    resp = await pg_client.get('/api/projects', headers=headers)
    assert resp.status_code == 200, resp.text
    projects = resp.json()
    assert isinstance(projects, list)
    assert len(projects) >= 2


async def test_pg_project_isolation(pg_client):
    h1 = await _headers(pg_client)
    h2 = await _headers(pg_client)
    await pg_client.post('/api/projects', json={'name': 'Private Project'}, headers=h1)
    resp = await pg_client.get('/api/projects', headers=h2)
    assert resp.status_code == 200
    names = [p['name'] for p in resp.json()]
    assert 'Private Project' not in names


# ---------------------------------------------------------------------------
# Memory CRUD
# ---------------------------------------------------------------------------

async def test_pg_create_memory(pg_client):
    headers = await _headers(pg_client)
    resp = await pg_client.post('/api/memory', json={'content': 'I prefer dark mode.'}, headers=headers)
    assert resp.status_code == 201, resp.text
    data = resp.json()
    assert data['content'] == 'I prefer dark mode.'
    assert 'id' in data


async def test_pg_list_memories(pg_client):
    headers = await _headers(pg_client)
    await pg_client.post('/api/memory', json={'content': 'Memory A'}, headers=headers)
    await pg_client.post('/api/memory', json={'content': 'Memory B'}, headers=headers)
    resp = await pg_client.get('/api/memory', headers=headers)
    assert resp.status_code == 200, resp.text
    items = resp.json()
    assert isinstance(items, list)
    contents = [m['content'] for m in items]
    assert 'Memory A' in contents
    assert 'Memory B' in contents


async def test_pg_delete_memory(pg_client):
    headers = await _headers(pg_client)
    create_resp = await pg_client.post('/api/memory', json={'content': 'To delete'}, headers=headers)
    assert create_resp.status_code == 201
    mem_id = create_resp.json()['id']

    del_resp = await pg_client.delete(f'/api/memory/{mem_id}', headers=headers)
    assert del_resp.status_code == 204

    list_resp = await pg_client.get('/api/memory', headers=headers)
    ids = [m['id'] for m in list_resp.json()]
    assert mem_id not in ids


async def test_pg_memory_isolation(pg_client):
    h1 = await _headers(pg_client)
    h2 = await _headers(pg_client)
    await pg_client.post('/api/memory', json={'content': 'Secret memory'}, headers=h1)
    resp = await pg_client.get('/api/memory', headers=h2)
    assert resp.status_code == 200
    contents = [m['content'] for m in resp.json()]
    assert 'Secret memory' not in contents


async def test_pg_memory_delete_owns_only(pg_client):
    """User cannot delete another user's memory."""
    h1 = await _headers(pg_client)
    h2 = await _headers(pg_client)
    create_resp = await pg_client.post('/api/memory', json={'content': "User1's memory"}, headers=h1)
    mem_id = create_resp.json()['id']
    del_resp = await pg_client.delete(f'/api/memory/{mem_id}', headers=h2)
    assert del_resp.status_code in (403, 404)


# ---------------------------------------------------------------------------
# Artifact persistence
# ---------------------------------------------------------------------------

async def test_pg_list_artifacts_empty(pg_client):
    headers = await _headers(pg_client)
    resp = await pg_client.get('/api/artifacts', headers=headers)
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


async def test_pg_artifacts_unauthenticated(pg_client):
    resp = await pg_client.get('/api/artifacts')
    assert resp.status_code == 401


# ---------------------------------------------------------------------------
# File upload security
# ---------------------------------------------------------------------------

async def test_pg_upload_requires_auth(pg_client):
    import io
    fake_project_id = str(uuid.uuid4())
    resp = await pg_client.post(
        f'/api/projects/{fake_project_id}/files',
        files={'file': ('test.txt', io.BytesIO(b'hello'), 'text/plain')},
    )
    assert resp.status_code == 401


async def test_pg_upload_wrong_project_owner(pg_client):
    """Cannot upload to another user's project."""
    import io
    h1 = await _headers(pg_client)
    h2 = await _headers(pg_client)

    proj_resp = await pg_client.post('/api/projects', json={'name': 'Owner project'}, headers=h1)
    if proj_resp.status_code not in (200, 201):
        pytest.skip('Project creation not available')
    proj_id = proj_resp.json()['id']

    resp = await pg_client.post(
        f'/api/projects/{proj_id}/files',
        files={'file': ('test.txt', io.BytesIO(b'hello'), 'text/plain')},
        headers=h2,
    )
    assert resp.status_code in (403, 404), f'Expected 403/404, got {resp.status_code}: {resp.text}'
