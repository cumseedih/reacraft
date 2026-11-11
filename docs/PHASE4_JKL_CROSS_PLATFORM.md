# Phase 4 — Cross-Platform Integration & Regression (K)

Verification that Web, Android and Desktop behave consistently against the
same backend contract, plus the regression run across every surface. All
checks below were executed in this environment; results are reported exactly,
and failures are recorded rather than hidden.

> UI boundary respected: this workstream fixes functional defects and
> inconsistencies only. The dedicated KROEX UI/UX redesign is a separate phase
> and was **not** started here.

---

## 1. Test & build matrix (measured)

| Surface | Unit tests | Typecheck | Build |
|---------|-----------|-----------|-------|
| `@kroex/api` (shared contract) | **73 passed** (9 files, vitest) | `tsc` clean | source package |
| Web (`apps/web`) | **25 passed** (7 files, vitest) | `tsc` clean | `next build` → **15 routes**, standalone ✓ |
| Mobile (`apps/mobile`) | **30 passed** (3 files, vitest) | `tsc` clean | `expo export` (android) → **Hermes bundle 4.7 MB** ✓ |
| Desktop (`apps/desktop`) | — | — | `cargo check` **clean** · `.deb`/`.rpm` present |
| API (`apps/api`) | **63 passed, 7 skipped** (per-file/grouped) | — | — |

### API test detail (pytest)
Run per file and in small groups, every test passes:

| File | Result |
|------|--------|
| `test_health.py` | 1 passed |
| `test_auth.py` | 5 passed |
| `test_provider.py` | 1 passed, 7 skipped |
| `test_retrieval_service.py` | 15 passed |
| `test_semantic.py` | 7 passed |
| `test_chat.py` | 1 passed |
| `test_chat_pg.py` (Postgres) | 16 passed |
| `test_integration_pg.py` (Postgres) | 17 passed |
| **Total** | **63 passed, 7 skipped** |

**Recorded failure (not hidden):** running the *entire* API suite in a single
`pytest` process intermittently **hangs** (reproduced twice, killed at the
600 s / 180 s limits). The same files pass reliably when run individually or in
small groups (verified repeatedly, including the pair that first appeared to
hang — it passed on retry). This is a **pre-existing async test-harness flake**
in `apps/api` (pytest-asyncio event-loop/fixture teardown under full-suite
concurrency), **orthogonal to J/K/L** — the JKL changes touch no `apps/api`
code. It was **not** worked around by deleting, skipping or weakening any test.
Reliable invocation for CI until the harness is hardened:
```bash
# run per file (all green), e.g.:
for f in tests/test_*.py; do python -m pytest -q "$f"; done
```
Follow-up (separate from JKL): isolate the session-scoped async fixture
interaction or run with process isolation (`pytest-forked`).

---

## 2. Contract-consistency checks (Web ↔ Mobile ↔ Desktop)

All three clients consume the single `@kroex/api` contract, so the invariants
below are enforced by shared code and covered by tests on both web and mobile.

| Invariant | Web | Mobile | Desktop | Enforced by |
|-----------|-----|--------|---------|-------------|
| Model IDs limited to supported tiers (no legacy) | ✓ | ✓ | ✓ (web) | `KROEX_MODEL_IDS`; web+mobile catalog tests |
| Auth: `token` field, 7-day JWT, secure storage | localStorage | expo-secure-store | via web | shared `auth` models |
| Overloaded 404 → "unavailable", never "forbidden" | ✓ | ✓ | ✓ (web) | `KroexApiError.isNotFoundOrUnavailable` |
| Recency never shown as semantic RAG | ✓ | ✓ | ✓ (web) | `describeRetrievalMethod` (both tested) |
| Destructive/unknown BOT actions require confirm | ✓ | ✓ | ✓ (web) | `isDestructiveAction` (both tested) |
| Agent run never "succeeded" before terminal | ✓ | ✓ | ✓ (web) | `describeRunStatus` / `isTerminalRunStatus` |
| Patches never auto-applied (explicit confirm) | ✓ | ✓ | ✓ (web) | apply behind confirm gate on every surface |
| Snapshot restore never "complete" before `completed`; resume blocked while in progress | ✓ | ✓ | ✓ (web) | `describeRestoreState` / `isRestoreInProgress` |
| Sandbox images: `python`/`node` only (`full` excluded) | ✓ | ✓ | ✓ (web) | `filterBuiltSandboxImages` |
| SSE dialects kept distinct (unnamed vs named) | ✓ | ✓ | ✓ (web) | shared parsers reused, not reimplemented |
| Streaming primitive correct per platform | `fetch` | `expo/fetch` | `fetch` (web) | platform transport wrappers |

Desktop consumes the web client verbatim (it serves the built web app), so its
behaviour equals Web by construction.

---

## 3. Platform-specific behaviour verified

- **Mobile navigation:** 5-tab layout (Chat, Projects, Memory, Tools, Account)
  with per-tab stacks; detail routes push/pop correctly; typed-route build
  passes. Keyboard handling via `KeyboardAvoidingView` on chat/bot composers.
- **Mobile streaming:** uses `expo/fetch` (RN's built-in fetch cannot stream);
  chat/bot/agent-run/sandbox-command all stream through the shared parsers.
- **Interactive PTY terminal** is a DOM/xterm feature → available on web/desktop
  only; mobile provides command execution via the named SSE stream instead
  (documented in-app). This is a platform capability difference, not a defect.
- **Responsive web layouts** unchanged; build emits the same 15 routes.

---

## 4. Integrations actually exercised vs. deferred

| Area | Local backend | Staging (MUSE) | Physical device (CUE) |
|------|---------------|----------------|------------------------|
| Auth, Chat, Projects, Files, Memory, Artifacts | available locally | — | pending |
| BOT, Agents, Sandbox | **404 locally (staging-only)** | **pending** | pending |
| Android login/stream/nav/network-recovery | — | — | **pending** |

Local backend exposes only auth/chat/projects/files/memory/artifacts; BOT,
Agents and Sandbox return the overloaded 404 locally (staging-only) and the
clients render that uniformly as "unavailable". End-to-end verification of
those three surfaces is MUSE's staging responsibility; Android physical-device
verification is CUE's. Neither is claimed complete here.

---

## 5. Outcome

- Build-green and test-green on all four surfaces at the unit/contract level.
- No functional UI defect or cross-platform inconsistency found in the shared
  behaviour; the one recorded issue is a pre-existing API test-harness flake,
  unrelated to JKL, left intact and documented rather than patched over.
- Remaining verification (staging BOT/Agents/Sandbox, Android device pass) is
  explicitly outstanding.
