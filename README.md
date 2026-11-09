# KROEX

AI-powered workspace with persistent memory, project-based RAG, and streaming chat.

## Architecture

| Layer | Technology |
|---|---|
| API | FastAPI (Python 3.13), async |
| Database | PostgreSQL 16 + pgvector 0.8.7 |
| Cache / rate-limit | Redis (in-memory fallback for dev) |
| Auth | JWT (HS256), 7-day expiry |
| AI providers | Anthropic, OpenAI, Google Gemini |
| Embeddings | OpenAI `text-embedding-3-small` (1536 dims) |
| File uploads | Local disk / S3 |

## Quick start (development)

### 1. Prerequisites

```bash
# PostgreSQL 16 + pgvector
sudo apt-get install -y postgresql-16 postgresql-16-pgvector

# Python 3.13
python3.13 -m venv apps/api/.venv
source apps/api/.venv/bin/activate
pip install -r apps/api/requirements.txt
```

### 2. Database setup

```bash
sudo -u postgres psql <<'SQL'
CREATE USER kroex WITH PASSWORD 'kroex_dev_only';
CREATE DATABASE kroex OWNER kroex;
GRANT ALL PRIVILEGES ON DATABASE kroex TO kroex;
\c kroex
CREATE EXTENSION IF NOT EXISTS vector;
SQL
```

### 3. Environment

Copy `.env.example` to `apps/api/.env` and set:

```env
DATABASE_URL=postgresql+asyncpg://kroex:kroex_dev_only@localhost:5432/kroex
JWT_SECRET=change-me-in-production
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
```

### 4. Run migrations and start

```bash
cd apps/api
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

## Running tests

```bash
cd apps/api

# SQLite unit tests (no external services required)
DATABASE_URL=sqlite+aiosqlite:///:memory: KROEX_ALLOW_TEXT_EMBEDDING=1 \
  pytest tests/test_auth.py tests/test_chat.py tests/test_health.py -v

# PostgreSQL integration tests (requires live PG)
PG_TEST_URL=postgresql+asyncpg://kroex_test:kroex_test@localhost:5432/kroex_test \
TEST_DATABASE_URL=$PG_TEST_URL \
  pytest -c pytest_pg.ini tests/ -v
```

**Test suite results** (Phase 3.3, all verified):

| Suite | File | Passed | Skipped |
|---|---|---|---|
| SQLite unit | test_auth, test_chat, test_health | 7 | 0 |
| PG integration | test_integration_pg.py | 17 | 0 |
| PG semantic | test_semantic.py | 7 | 0 |
| PG service-layer | test_retrieval_service.py | 15 | 0 |
| PG provider | test_provider.py | 3 | 5 |
| PG chat persistence | test_chat_pg.py | 16 | 0 |
| **Total** | | **65** | **5** |

Skipped tests require real API keys (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`) — not fabricated.

## Security

- **JWT secret** must be changed from default before production deployment.  
  `python3 -c "import secrets; print(secrets.token_hex(64))"`
- **Database password** — the default `kroex_dev_only` is blocked in `environment=production`.
- **API keys** are server-side only; never returned to clients or logged.
- **File uploads** are restricted to `.txt`, `.md`, `.pdf`, `.docx`; size limit configurable via `MAX_UPLOAD_SIZE_MB`.
- **CORS** is locked to `http://localhost:3000` by default; set `ALLOWED_ORIGINS` for production.
- **Rate limiting** — 60 requests/minute per IP (in-memory; replace with Redis for multi-process deployments).
- **FastAPI interactive docs** are disabled when `DEBUG=false`.

See [apps/api/PRODUCTION_SETUP.md](apps/api/PRODUCTION_SETUP.md) for the full production checklist.

## Docker

Requires a Docker daemon. The daemon socket is not available in this cloud container environment.  
Expected `docker compose up --build` workflow is documented in `PRODUCTION_SETUP.md`.

## Project structure

```
apps/
  api/              FastAPI application
    app/
      routers/      HTTP endpoints (auth, chat, projects, files, memory, artifacts)
      models/       SQLAlchemy ORM models
      schemas/      Pydantic request/response schemas
      services/     AI, embeddings, retrieval, document processing
      middleware/   Rate limiting
      utils/        JWT auth helpers
    alembic/        Database migrations
    tests/          Test suite
```
