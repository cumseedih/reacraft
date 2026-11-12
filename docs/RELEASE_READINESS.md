# KROEX Release Readiness — Gated Pilot

Target: a **controlled, gated pilot** on infrastructure the operator controls.
**Not** a public launch. This document is the go-live gate: every "Required"
row must be satisfied by the operator before onboarding pilot users.

See also: `DEPLOYMENT.md` (install + config), `docs/OPERATIONS_RUNBOOK.md`
(backup/restore, rollback, migrations, monitoring), and
`docs/PHASE4_JKL_CROSS_PLATFORM.md` (regression matrix).

---

## 1. Build & test status (this branch)

| Surface | Build | Tests | Typecheck |
|---------|-------|-------|-----------|
| `@kroex/api` (shared contract) | n/a (source pkg) | 73 vitest ✓ | tsc ✓ |
| Web (`apps/web`) | `next build` → 15 routes, standalone ✓ | 25 vitest ✓ | tsc ✓ |
| Mobile (`apps/mobile`) | `expo export` (android) → Hermes bundle ✓ | 30 vitest ✓ | tsc ✓ |
| Desktop (`apps/desktop`) | `cargo check` ✓ · installers built (I) ✓ | — | — |
| API (`apps/api`) | — | pytest — see Cross-Platform report | — |

---

## 2. Artifact status

| Artifact | Status | Location / Notes |
|----------|--------|------------------|
| Web production server | ✅ Built | `apps/web/.next/standalone` (output: standalone) |
| Desktop `.deb` | ✅ Built | `apps/desktop/src-tauri/target/release/bundle/deb/KROEX_1.0.0_amd64.deb` (65.41 MiB) |
| Desktop `.rpm` | ✅ Built | `…/bundle/rpm/KROEX-1.0.0-1.x86_64.rpm` (65.75 MiB) |
| Desktop AppImage | ⛔ Blocked | `linuxdeploy` needs FUSE (unavailable in CI container). Build on a FUSE-capable host. |
| Mobile JS/Hermes bundle | ✅ Exported | `apps/mobile/dist` via `expo export` — validates the full RN bundle. |
| Mobile APK / AAB | ⛔ Blocked here | Needs the Android SDK (local `expo run:android --variant release`) or EAS cloud (`eas build`). Neither is available in this container (no `ANDROID_HOME`, no `eas-cli`). Produce on a machine with the Android SDK or via EAS. |
| Desktop macOS / Windows installers | ⛔ Not built | Require macOS / Windows hosts respectively (Tauri cross-compilation limitation). |

> Honesty note: artifacts marked ⛔ were **not** produced in this environment.
> The commands to produce them are documented; no packaged artifact is claimed
> to exist unless it is listed ✅ with a real on-disk path above.

---

## 3. Go-live checklist (operator)

### Security / auth (Required)
- [ ] `ENVIRONMENT=production` set; API refuses to boot with a default
      `JWT_SECRET` or the dev `DATABASE_URL` (validator verified in code).
- [ ] `JWT_SECRET` is a fresh 64-hex random value, stored only in server env.
- [ ] Provider API keys set **only** in API server env; confirmed absent from
      every client build and from Git (secrets scan clean).
- [ ] `ALLOWED_ORIGINS` lists only the pilot's real origins.
- [ ] All endpoints require JWT except `/api/auth/register` and
      `/api/auth/login` (enforced in code).
- [ ] HTTPS terminated at the proxy; PostgreSQL not publicly reachable.
- [ ] 7-day JWT expiry understood; there is **no** server-side logout/refresh
      — clients clear the token locally (documented in UI copy).

### Database (Required)
- [ ] `pgvector` extension enabled on the pilot DB.
- [ ] `alembic upgrade head` applied deliberately (not via CI, not against the
      legacy `delvin` DB), current revision recorded for rollback.
- [ ] Backup job scheduled (`pg_dump` + uploads tarball) and a test restore
      has succeeded into a scratch DB (`OPERATIONS_RUNBOOK §3`).

### Sandbox isolation (Required if sandbox enabled)
- [ ] gVisor (runsc) runtime confirmed; egress default `none`, `proxy` only via
      explicit time-boxed grants.
- [ ] Only `python` / `node` images provisionable; `full` excluded.
- [ ] Plan/admission limits enforced server-side; confirmation gates intact
      (patch apply, snapshot restore, session destroy, destructive BOT action).
- [ ] No Docker socket exposed to sessions.

### Feature flags / restrictions (Required)
- [ ] Semantic RAG **not** activated (recency fallback; UI labels it honestly).
- [ ] Code Reviews surface **disabled** (not wired in the client).
- [ ] `services/ai.py` unchanged in this phase.

### Monitoring (Recommended before pilot)
- [ ] API logs shipped to an aggregator; alert on 5xx rate + DB connection
      failures.
- [ ] Error-tracking sink attached to the API process.
- [ ] `GET /api/health` wired as the liveness probe.
- [ ] DB disk + pgvector index health monitored.

### Clients (Required for the surfaces in the pilot)
- [ ] Web: `NEXT_PUBLIC_API_URL` / proxy target points at the pilot API.
- [ ] Desktop: `.deb`/`.rpm` installed on a host with Node + FUSE as needed;
      `BACKEND_URL` points at the pilot API; launch → embedded server → app.
- [ ] Mobile: `EXPO_PUBLIC_API_URL` reachable from test devices; APK/AAB built
      on an Android-SDK host or EAS; physical-device checklist (see
      Cross-Platform report) completed with CUE.

---

## 4. Known blockers / deferred (carried into the pilot)

| Item | Impact | Resolution path |
|------|--------|-----------------|
| Mobile APK/AAB not built here | No installable Android binary from CI | Build on Android-SDK host / EAS cloud |
| Desktop AppImage not built | Only deb/rpm Linux installers | Build on FUSE-capable host |
| macOS/Windows desktop installers | Linux-only installers produced | Build on the respective OS |
| Android physical-device verification | Not performed in container | CUE device pass (Cross-Platform report §Device) |
| Staging end-to-end (BOT/Agents/Sandbox) | Local backend 404s these (staging-only) | MUSE staging verification |
| Semantic RAG | Deferred — recency fallback | Out of scope this phase |

**Release-ready statement:** The branch is build-green and test-green on all
four surfaces at the unit/contract level, with web + desktop + mobile-bundle
artifacts produced. It is **not** "release-ready" for the pilot until the
Required rows above are satisfied **and** the staging (MUSE) and Android
physical-device (CUE) verifications are complete — both are outstanding and
are explicitly not claimed here.
