# KROEX API — Production Setup Guide

## Prerequisites

- Ubuntu 22.04 / Debian 12 (or equivalent)
- PostgreSQL 16
- Python 3.11+
- Redis 7+

---

## 1. Install PostgreSQL 16 + pgvector

```bash
# Add the PGDG apt repository
sudo apt-get install -y curl ca-certificates
curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc \
  | sudo gpg --dearmor -o /etc/apt/trusted.gpg.d/postgresql.gpg
echo "deb [signed-by=/etc/apt/trusted.gpg.d/postgresql.gpg] \
  https://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" \
  | sudo tee /etc/apt/sources.list.d/pgdg.list

sudo apt-get update
sudo apt-get install -y postgresql-16 postgresql-16-pgvector
```

---

## 2. Create the database and user

```bash
sudo -u postgres psql <<'SQL'
CREATE USER kroex WITH PASSWORD 'your_strong_password_here';
CREATE DATABASE kroex OWNER kroex;
\c kroex
-- pgvector extension requires superuser; run once per database
CREATE EXTENSION IF NOT EXISTS vector;
GRANT ALL PRIVILEGES ON DATABASE kroex TO kroex;
SQL
```

> **Important:** `CREATE EXTENSION vector` requires a PostgreSQL superuser.
> Run it as the `postgres` superuser (shown above) before the application user
> can use vector columns.  The Alembic migration will verify pgvector is loaded
> and raise a clear error if it is not.

---

## 3. Environment variables

Create `apps/api/.env` (never commit this file):

```dotenv
# Database
DATABASE_URL=postgresql+asyncpg://kroex:your_strong_password_here@localhost:5432/kroex
DATABASE_POOL_SIZE=10

# Auth
JWT_SECRET=<generate with: python -c "import secrets; print(secrets.token_hex(32))">
JWT_EXPIRY_DAYS=7

# AI providers (at least one required for chat)
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...

# File uploads
UPLOAD_DIR=/var/kroex/uploads
MAX_UPLOAD_MB=50

# Redis (for future rate limiting / caching)
REDIS_URL=redis://localhost:6379/0

# Logging
LOG_LEVEL=INFO
DEBUG=false
```

---

## 4. Install Python dependencies

```bash
cd apps/api
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

---

## 5. Run Alembic migrations

```bash
cd apps/api
source .venv/bin/activate
alembic upgrade head
```

The migration:
- Attempts `CREATE EXTENSION IF NOT EXISTS vector` inside a PL/pgSQL block.
- If pgvector is available, creates `VECTOR(1536)` columns on
  `document_chunks.embedding` and `memories.embedding`.
- If pgvector is **not** available, raises a `RuntimeError` with a clear
  message.  Set `KROEX_ALLOW_TEXT_EMBEDDING=1` only in CI/test environments
  to skip this check and use `TEXT` columns instead.

---

## 6. Create the upload directory

```bash
sudo mkdir -p /var/kroex/uploads
sudo chown www-data:www-data /var/kroex/uploads   # adjust to your app user
```

---

## 7. Start the API server

```bash
cd apps/api
source .venv/bin/activate
uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4
```

For production, use a process manager (systemd, supervisor) and a reverse
proxy (nginx) in front of uvicorn.

---

## 8. Verify semantic search is working

```bash
# Register a test user
curl -s -X POST http://localhost:8000/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"test@example.com","name":"Test","password":"pass1234"}' | jq .

# Log in and store token
TOKEN=$(curl -s -X POST http://localhost:8000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"test@example.com","password":"pass1234"}' | jq -r .token)

# Create two memories
curl -s -X POST http://localhost:8000/api/memory \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"content":"Python is a programming language"}' | jq .

curl -s -X POST http://localhost:8000/api/memory \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"content":"The Eiffel Tower is in Paris"}' | jq .

# Wait a moment for background embedding tasks
sleep 3

# Semantic search — should return Python memory first
curl -s "http://localhost:8000/api/memory/search?q=programming+languages" \
  -H "Authorization: Bearer $TOKEN" | jq .
```

If `OPENAI_API_KEY` is set and pgvector is loaded, the response will show
`"method": "semantic"` and the most relevant memory will rank first.

---

## 9. Docker Compose (development only)

```bash
# From the monorepo root:
docker compose up --build
```

The compose file starts:
- `api` — FastAPI on port 8000
- `postgres` — PostgreSQL 16 with pgvector
- `redis` — Redis 7

> **Note:** The Docker daemon is not available in this CI container, so the
> compose stack has not been tested in this session.  Test it on a machine
> with Docker installed.

---

## Security checklist

- [ ] `JWT_SECRET` is at least 256-bit random (never the default or hardcoded)
- [ ] `DATABASE_URL` password is strong and not in version control
- [ ] `.env` file is in `.gitignore`
- [ ] PostgreSQL listens on `localhost` only (or is behind a firewall)
- [ ] `UPLOAD_DIR` is not web-accessible
- [ ] `DEBUG=false` in production
- [ ] API keys (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`) are rotated regularly
- [ ] File upload size limit (`MAX_UPLOAD_MB`) is enforced at the reverse proxy too

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `RuntimeError: pgvector extension is not available` | pgvector not installed or extension not created | Run `CREATE EXTENSION vector;` as superuser |
| `permission denied to create extension "vector"` | Running as non-superuser | Run as `postgres` superuser |
| `DuplicateObjectError: type "user_plan" already exists` | Old migration artifact | Drop and recreate the DB; the plan column is now `String(10)` |
| `Future attached to a different loop` in PG tests | asyncio loop scope mismatch | Use `pytest -c pytest_pg.ini` for PG tests |
| Embedding column is `text` not `vector` | Migration ran before pgvector installed | Drop tables, install pgvector, re-run migration |
| `ValidationError: Input should be a valid string` for `created_at` | Old code had `created_at: str` | Fixed — all datetime fields are now `datetime` type |
