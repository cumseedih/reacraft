from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from sqlalchemy import text
from .config import get_settings
from .database import engine, Base
from .middleware.rate_limit import RateLimitMiddleware
from .routers import auth, chat, projects, files, memory, artifacts

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Enable pgvector extension and create tables
    async with engine.begin() as conn:
        await conn.execute(text('CREATE EXTENSION IF NOT EXISTS vector'))
        await conn.run_sync(Base.metadata.create_all)
    yield
    await engine.dispose()


app = FastAPI(
    title=settings.app_name,
    version=settings.version,
    docs_url='/docs' if settings.debug else None,
    redoc_url='/redoc' if settings.debug else None,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)
app.add_middleware(GZipMiddleware, minimum_size=1024)
app.add_middleware(RateLimitMiddleware, calls=settings.rate_limit_per_minute)

app.include_router(auth.router)
app.include_router(chat.router)
app.include_router(projects.router)
app.include_router(files.router)
app.include_router(memory.router)
app.include_router(artifacts.router)


@app.get('/api/health')
async def health():
    return {'status': 'ok', 'version': settings.version}
