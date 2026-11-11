# KROEX Deployment Guide

## Overview

KROEX is a monorepo with four deployable targets:
- **API** (`apps/api`): FastAPI + PostgreSQL 16 + pgvector
- **Web** (`apps/web`): Next.js 15 static/server-rendered app
- **Desktop** (`apps/desktop`): Tauri 2 (embeds the Next standalone server)
- **Mobile** (`apps/mobile`): Expo SDK 58 / React Native 0.88 (Android + iOS)

> Operational procedures (backup/restore, rollback, migration steps,
> monitoring) are in `docs/OPERATIONS_RUNBOOK.md`. The gated-pilot go-live
> gate is in `docs/RELEASE_READINESS.md`.

---

## Prerequisites

| Tool       | Version     |
|------------|-------------|
| Node.js    | ≥ 20        |
| pnpm       | ≥ 9         |
| Python     | 3.13        |
| PostgreSQL | 16 + pgvector |
| Redis      | 7 (optional for rate-limiting) |

---

## 1. Environment Configuration

### API — `apps/api/.env.production`

```env
ENVIRONMENT=production

# Database (required — do NOT use the dev default password)
DATABASE_URL=postgresql+asyncpg://<user>:<strong-password>@<host>:5432/kroex

# Redis (optional — disable rate limiting if not using Redis)
REDIS_URL=redis://<host>:6379/0

# JWT (required — generate with: python3 -c "import secrets; print(secrets.token_hex(64))")
JWT_SECRET=<64-hex-char-random-secret>

# AI providers (at least one required for chat to work)
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
GOOGLE_API_KEY=...

# File uploads
UPLOAD_DIR=/app/uploads

# CORS — list all origins that may call the API
ALLOWED_ORIGINS=["https://app.yourdomain.com","https://yourdomain.com"]

# Rate limiting
RATE_LIMIT_PER_MINUTE=60
```

The API **will not start** in `ENVIRONMENT=production` if `JWT_SECRET` is the
default value or `DATABASE_URL` contains `kroex_dev_only`.

### Web — `apps/web/.env.production`

```env
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
```

The web app proxies `/api/*` to the backend via `next.config.js` rewrites. In
production the proxy target must be changed to the real API URL, or
`NEXT_PUBLIC_API_URL` must be set for direct client calls.

### Mobile — `apps/mobile/.env`

```env
EXPO_PUBLIC_API_URL=https://api.yourdomain.com
```

---

## 2. Database Setup

```bash
cd apps/api

# Install Python dependencies
python3.13 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Enable pgvector extension (run once as superuser)
psql -U postgres -d kroex -c "CREATE EXTENSION IF NOT EXISTS vector;"

# Tables are created automatically on first startup via app.main startup event.
# For migrations use Alembic:
alembic upgrade head
```

---

## 3. API Production Start

```bash
cd apps/api
source .venv/bin/activate

# Single-process (use Gunicorn + Uvicorn workers in production)
uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4

# Or with Gunicorn
gunicorn app.main:app \
  -k uvicorn.workers.UvicornWorker \
  -w 4 \
  --bind 0.0.0.0:8000 \
  --access-logfile - \
  --error-logfile -
```

Upload directory must exist and be writable:
```bash
mkdir -p /app/uploads && chown www-data:www-data /app/uploads
```

---

## 4. Web Production Build

```bash
cd apps/web
pnpm install
pnpm build          # outputs to .next/
pnpm start          # starts the Next.js server
```

For static export (CDN deployment):
```bash
# In next.config.js set: output: 'export'
pnpm build          # outputs to out/
```

---

## 5. Desktop Release Build

```bash
cd apps/desktop
pnpm install
pnpm tauri build    # outputs installer to src-tauri/target/release/bundle/
```

Production architecture (as of Increment I): the release build **embeds the
Next.js standalone server** and spawns it on a loopback port at launch (the
Rust side navigates the webview to it once it accepts connections); it does
**not** depend on a dev server. Point the embedded server at the API with the
`BACKEND_URL` environment variable at launch. In debug builds Tauri loads the
Next dev server (`devUrl`) directly.

Linux installers produced by `tauri build` here: `.deb` and `.rpm`
(`bundle.targets`). The AppImage target needs FUSE and must be built on a
FUSE-capable host; macOS/Windows installers must be built on those OSes.
Requires a Node.js runtime on the host to run the embedded server (bundling a
Node runtime is a documented follow-up).

---

## 6. Android Release Build

```bash
cd apps/mobile

# Validate the JS/Hermes bundle (no native SDK needed; used in CI):
npx expo export --platform android     # → dist/ (Hermes bytecode bundle)

# Build an installable binary (needs the Android SDK, NOT available in the
# CI container — build on a machine with ANDROID_HOME set, or via EAS cloud):
npx eas-cli build --platform android --profile production   # EAS cloud
# or, locally with the Android SDK installed:
npx expo run:android --variant release
```

Before release:
1. Set `EXPO_PUBLIC_API_URL` in `apps/mobile/.env` (a URL the device can
   reach — never `localhost` on a physical device).
2. Update `app.json` with correct `package`/`bundleIdentifier`, `versionCode`,
   `version`.
3. Generate a release keystore and configure `eas.json`.

> Note: `expo export` validates that the entire app bundles and compiles; it
> does **not** produce an installable APK/AAB. The APK/AAB step requires the
> Android SDK or EAS and must run outside this CI container.

---

## 7. iOS Release Configuration

```bash
cd apps/mobile
npx eas-cli build --platform ios --profile production
```

Before release:
1. Set `EXPO_PUBLIC_API_URL` in `apps/mobile/.env`
2. Update `app.json` with correct `bundleIdentifier`, `buildNumber`, `version`
3. Configure code signing in `eas.json` with Apple Team ID and certificates

---

## 8. Security Checklist

| Item | Status |
|------|--------|
| `JWT_SECRET` is a random 64-char hex string | Required before go-live |
| `DATABASE_URL` uses a unique strong password | Required before go-live |
| API keys (Anthropic/OpenAI) stored only in server env, never in frontend | ✓ Enforced by code |
| `ALLOWED_ORIGINS` lists only production domains | Required before go-live |
| `ENVIRONMENT=production` triggers secret validation | ✓ Implemented |
| File upload directory is outside the web root | ✓ `/app/uploads` |
| Rate limiting configured (60 req/min default) | ✓ Configured |
| HTTPS enforced at load balancer / reverse proxy | Operator responsibility |
| PostgreSQL not publicly accessible | Operator responsibility |
| All API endpoints require JWT except `/api/auth/register` and `/api/auth/login` | ✓ Enforced by code |

---

## 9. Monitoring and Health

- **Health endpoint**: `GET /health` → `{"status": "ok", "version": "..."}`
- **Docs** (debug mode only): `GET /docs` and `GET /redoc`

Suggested monitoring:
- Uptime check on `GET /health`
- Database connection pool exhaustion alerts
- Disk usage on `UPLOAD_DIR`
- API response time P95/P99

---

## 10. Backup and Rollback

### Database backup
```bash
pg_dump -Fc kroex > kroex_$(date +%Y%m%d_%H%M%S).dump
```

### Restore
```bash
pg_restore -d kroex kroex_<timestamp>.dump
```

### Upload directory backup
```bash
tar czf uploads_$(date +%Y%m%d).tar.gz /app/uploads
```

### Rollback procedure
1. Roll back the Docker image or git checkout to the previous tag
2. If DB migrations ran: `alembic downgrade -1`
3. Restart API and web services
4. Verify `GET /health` returns 200

---

## 11. Test Results (CI reference)

Tests were executed against an in-memory SQLite database (no live PostgreSQL required for unit tests).

```
apps/api — pytest tests/test_auth.py tests/test_health.py tests/test_provider.py tests/test_chat.py
  8 passed, 7 skipped (live API key tests), 0 failed

  Skipped tests require live API keys (ANTHROPIC_API_KEY / OPENAI_API_KEY).
  Retrieval/semantic tests (test_retrieval_service.py, test_semantic.py) require
  a live PostgreSQL+pgvector instance and are excluded from the in-process CI suite.

apps/web — Next.js production build: PASS (all routes compiled, 0 TypeScript errors)
apps/mobile — expo export --platform android: PASS (1318 modules)
            — expo export --platform ios: PASS (1318 modules)
            — TypeScript check: PASS (0 errors)
```
