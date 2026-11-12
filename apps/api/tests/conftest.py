"""
Test fixtures: in-memory SQLite database + httpx AsyncClient.
SQLite avoids a live PostgreSQL requirement in CI;
pgvector Vector columns are replaced with Text for compatibility.
"""
import pytest
import pytest_asyncio
import os

# Point the app at SQLite for tests (must be set before app is imported)
os.environ.setdefault('DATABASE_URL', 'sqlite+aiosqlite:///:memory:')
os.environ.setdefault('JWT_SECRET', 'test-secret-not-for-production')
os.environ.setdefault('UPLOAD_DIR', '/tmp/kroex_test_uploads')

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from httpx import AsyncClient, ASGITransport


@pytest_asyncio.fixture
async def engine():
    eng = create_async_engine('sqlite+aiosqlite:///:memory:', echo=False, future=True)

    # Import all models to populate Base.metadata
    import app.models.user  # noqa
    import app.models.conversation  # noqa
    import app.models.project  # noqa
    import app.models.memory  # noqa
    import app.models.artifact  # noqa

    from app.database import Base
    from pgvector.sqlalchemy import Vector
    from sqlalchemy import Text

    # SQLite does not support pgvector; swap Vector columns to Text temporarily.
    # Save originals so PG tests running in the same session see the right types.
    swapped: list[tuple] = []
    for table in Base.metadata.tables.values():
        for col in table.columns:
            if isinstance(col.type, Vector):
                swapped.append((col, col.type))
                col.type = Text()

    async with eng.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield eng
    await eng.dispose()

    # Restore original Vector types so subsequent PG tests are unaffected.
    for col, orig_type in swapped:
        col.type = orig_type


@pytest_asyncio.fixture
async def db_session(engine):
    Session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with Session() as session:
        yield session


@pytest_asyncio.fixture
async def client(engine):
    # Invalidate the lru_cache so env vars above are picked up
    from app.config import get_settings
    get_settings.cache_clear()

    from app.main import app
    from app.database import get_db

    Session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

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
