import pytest
import uuid


def unique_email() -> str:
    return f'test_{uuid.uuid4().hex[:8]}@example.com'


@pytest.mark.asyncio
async def test_register(client):
    resp = await client.post('/api/auth/register', json={
        'email': unique_email(),
        'password': 'Password1!',
        'name': 'Test User',
    })
    assert resp.status_code == 201
    data = resp.json()
    assert 'token' in data
    assert 'user' in data
    assert data['user']['email'] is not None


@pytest.mark.asyncio
async def test_register_duplicate(client):
    email = unique_email()
    payload = {'email': email, 'password': 'Password1!', 'name': 'User'}
    r1 = await client.post('/api/auth/register', json=payload)
    assert r1.status_code == 201
    r2 = await client.post('/api/auth/register', json=payload)
    assert r2.status_code == 409


@pytest.mark.asyncio
async def test_login(client):
    email = unique_email()
    await client.post('/api/auth/register', json={
        'email': email, 'password': 'Password1!', 'name': 'User',
    })
    resp = await client.post('/api/auth/login', json={
        'email': email, 'password': 'Password1!',
    })
    assert resp.status_code == 200
    data = resp.json()
    assert 'token' in data


@pytest.mark.asyncio
async def test_me_authenticated(client):
    email = unique_email()
    reg = await client.post('/api/auth/register', json={
        'email': email, 'password': 'Password1!', 'name': 'User',
    })
    token = reg.json()['token']
    resp = await client.get('/api/auth/me', headers={'Authorization': f'Bearer {token}'})
    assert resp.status_code == 200
    assert resp.json()['email'] == email


@pytest.mark.asyncio
async def test_me_unauthenticated(client):
    resp = await client.get('/api/auth/me')
    assert resp.status_code == 401
