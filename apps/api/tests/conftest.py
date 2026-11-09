"""
Test fixtures: in-memory SQLite database + httpx AsyncClient.
SQLite is used to avoid requiring a live PostgreSQL during CI;
pgvector Vector columns are replaced by Text for compatibility.
"""
import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy import event
from httpx import AsyncClient, ASGITransport


@pytest_asyncio.fixture(scope='session')
async def engine():
    eng = create_async_engine('sqlite+aiosqlite:///:memory:', echo=False, future=True)
    # Patch Vector columns: replace pgvector type with Text before metadata creation
    from sqlalchemy import Text
    from pgvector.sqlalchemy import Vector
    from sqlalchemy import Column

    # Import all models to populate metadata; patch Vector -> Text
    import apps.api.app.models.user  # noqa
    import apps.api.app.models.conversation  # noqa
    import apps.api.app.models.project  # noqa
    import apps.api.app.models.memory  # noqa
    import apps.api.app.models.artifact  # noqa

    from apps.api.app.database import Base
    for table in Base.metadata.tables.values():
        for col in table.columns:
            if isinstance(col.type, Vector):
                col.type = Text()

    async with eng.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield eng
    await eng.dispose()


@pytest_asyncio.fixture
async def db_session(engine):
    Session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with Session() as session:
        yield session


@pytest_asyncio.fixture
async def client(engine):
    from apps.api.app.main import app
    from apps.api.app import database

    # Override DB session with test engine
    Session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async def override_get_db():
        async with Session() as session:
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise

    from apps.api.app.database import get_db
    app.dependency_overrides[get_db] = override_get_db

    async with AsyncClient(transport=ASGITransport(app=app), base_url='http://test') as ac:
        yield ac

    app.dependency_overrides.clear()
