# KROEX Operations Runbook

Operational procedures for a **controlled, gated pilot** (not a public
launch). Covers backup/restore, deployment/rollback, database migrations and
startup behaviour, and the monitoring/logging review. Pairs with
`DEPLOYMENT.md` (install + config) and `apps/api/PRODUCTION_SETUP.md`.

> Scope guard for this phase: **no public deployment, no production rollout,
> no automatic migration against a production database.** The commands below
> are the documented procedure for an operator to run deliberately against a
> pilot environment they control. Nothing here runs automatically.

---

## 1. Configuration & environment audit

### 1.1 API (`apps/api/.env.production`) — required
| Variable | Required | Notes |
|----------|----------|-------|
| `ENVIRONMENT` | yes | Must be `production` to trigger secret validation. |
| `DATABASE_URL` | yes | `postgresql+asyncpg://…`; must **not** contain `kroex_dev_only` (startup refuses). |
| `JWT_SECRET` | yes | 64-hex random; must **not** be `change-me-in-production` (startup refuses). |
| `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` / `GOOGLE_API_KEY` | ≥1 | Server-side only. Never shipped to any client. |
| `UPLOAD_DIR` | yes | Writable, outside web root. |
| `ALLOWED_ORIGINS` | yes | JSON array of exact production origins only. |
| `REDIS_URL` | optional | Rate limiting; omit to disable. |
| `RATE_LIMIT_PER_MINUTE` | optional | Default 60. |
| `S3_BUCKET` / `S3_REGION` / `AWS_*` | optional | Blank → local-disk uploads. |

The startup validator (`app/config.py :: check_production_secrets`) raises and
**prevents boot** if, under `ENVIRONMENT=production`, `JWT_SECRET` is the
default or `DATABASE_URL` still carries the dev password. This is verified by
inspection; keep it as the first line of the go-live gate.

### 1.2 Web (`apps/web/.env.production`)
- `NEXT_PUBLIC_API_URL` — set only for direct browser→API calls; otherwise the
  app calls same-origin `/api/*` and the server proxies to `BACKEND_URL`
  (the pattern used on loopback-only backends). No secrets belong in any
  `NEXT_PUBLIC_*` value.

### 1.3 Mobile (`apps/mobile/.env`)
- `EXPO_PUBLIC_API_URL` — a URL the device can actually reach (LAN IP or a
  deployed origin; never `localhost` on a physical device). `EXPO_PUBLIC_*`
  values are inlined into the binary — non-secret only.

### 1.4 Desktop
- Production build embeds the Next standalone server and spawns it on
  loopback; `BACKEND_URL` (env at launch) points it at the API. No secrets are
  baked into the bundle.

**Secret-handling rule (all surfaces):** provider keys and the JWT secret live
only in server-side API env. No client build (web/mobile/desktop) contains
them, and none are committed to Git.

---

## 2. Database migrations & startup behaviour

- Schema source of truth: **Alembic** (`apps/api/alembic/`, baseline
  `0001_initial_schema.py`). Apply with `alembic upgrade head`.
- The app's startup lifespan also runs `Base.metadata.create_all`, which
  creates any missing tables but **does not alter existing ones**. For a
  pilot with an existing database, **Alembic is authoritative** — run
  `alembic upgrade head` as a deliberate, reviewed step; do not rely on
  `create_all` for schema changes.
- `pgvector` must be enabled once per database:
  `CREATE EXTENSION IF NOT EXISTS vector;`

**Migration procedure (manual, pilot DB):**
```bash
cd apps/api && source .venv/bin/activate
alembic current                 # record the current revision (for rollback)
alembic upgrade head            # apply
alembic current                 # confirm
```
Never point this at the legacy `delvin` database. Never run it automatically
from CI against production.

---

## 3. Backup & restore (PostgreSQL)

### 3.1 Backup
```bash
# Logical backup (schema + data). Run on a schedule from the DB host.
pg_dump "postgresql://<user>:<pw>@<host>:5432/kroex" \
  --format=custom --no-owner --file "kroex-$(date +%Y%m%d-%H%M%S).dump"

# Uploaded files (when using local-disk storage)
tar czf "kroex-uploads-$(date +%Y%m%d-%H%M%S).tar.gz" -C "$UPLOAD_DIR" .
```
Store backups off-host (e.g. the S3 bucket already configured for uploads).
Keep at least the last 7 daily + 4 weekly dumps for a pilot.

### 3.2 Restore
```bash
# 1. Stop the API so nothing writes during restore.
# 2. Recreate the database (or restore into a fresh one), then:
createdb kroex                           # if restoring into a new DB
psql -d kroex -c "CREATE EXTENSION IF NOT EXISTS vector;"
pg_restore --no-owner --dblist kroex --clean --if-exists \
  --dbname "postgresql://<user>:<pw>@<host>:5432/kroex" kroex-YYYYMMDD-HHMMSS.dump
# 3. Restore uploads: tar xzf kroex-uploads-*.tar.gz -C "$UPLOAD_DIR"
# 4. alembic current  →  confirm the schema revision matches the app.
# 5. Start the API; hit /api/health.
```
Always test a restore into a scratch database before trusting a backup.

---

## 4. Deployment & rollback

### 4.1 Deploy (pilot)
1. Snapshot the DB (§3.1) and record `alembic current`.
2. Build artifacts: API image, `apps/web` (`pnpm --filter @kroex/web build`),
   desktop installers, mobile build.
3. Apply migrations (§2) during a maintenance window.
4. Roll out API, then web; smoke-test `/api/health`, login, a chat stream.

### 4.2 Rollback
- **App code:** redeploy the previous image/build (keep the prior tag).
- **Database:** if a migration must be undone, `alembic downgrade <prev-rev>`
  using the revision recorded in §4.1; if a migration is destructive or has no
  safe downgrade, restore from the pre-deploy backup (§3.2) instead.
- **Config:** keep the previous `.env.production` so a bad config change can be
  reverted independently of code.
- Never rewrite history on a shared environment; roll forward with a new fix
  where a downgrade is unsafe.

---

## 5. Logging, error reporting & monitoring (review)

Current state (observed in the codebase) and the pilot baseline:
- **API** logs to stdout/stderr via Uvicorn/Gunicorn access + error logs
  (see `DEPLOYMENT.md §3`). Ship these to the platform's log aggregator.
- **Health:** `GET /api/health` is the liveness probe (used in smoke tests).
- **Rate limiting:** 429 with `Retry-After` when Redis is configured; clients
  honour it via the shared `withRetryAfter429` helper.
- **In-stream errors** keep HTTP 200 and arrive as typed `error` events — the
  web and mobile clients render them without masking failures.
- **Recommended before pilot (operator):** attach an error-tracking sink
  (e.g. Sentry) to the API process, alert on API 5xx rate and DB connection
  failures, and monitor DB disk + `pgvector` index health. These are
  deployment-environment concerns, not code changes.

---

## 6. Sandbox isolation & resource limits (verify before enabling)

- Runtime is **gVisor (runsc)**; sessions run isolated with restricted egress
  (default `network_policy: none`; `proxy` requires an explicit, time-boxed
  egress grant). Do not weaken either.
- Only **built images** (`python`, `node`) are provisionable; the `full`
  image is excluded everywhere via `filterBuiltSandboxImages`.
- Plan/admission limits come from `GET /api/sandbox/config.limits` and are
  surfaced read-only in the UI; enforcement is server-side.
- Confirmation gates (destructive BOT actions, patch apply, snapshot restore,
  session destroy) are preserved on every surface and must stay.
