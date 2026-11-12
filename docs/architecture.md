# KROEX Architecture

> Think deeper. Build further.

## Overview

KROEX is a production-ready multi-platform AI assistant ecosystem built as a pnpm monorepo.

```
koex/
├── apps/
│   ├── web/        # Next.js 15 + React 19
│   ├── api/        # FastAPI (Python)
│   ├── mobile/     # Expo 52 (React Native)
│   └── desktop/   # Tauri 2
```

## Stack Summary

### Frontend (`apps/web`)
- Next.js 15, React 19, TypeScript
- Tailwind CSS v3, Radix UI, Framer Motion
- Zustand (state), TanStack Query (server state)
- SSE streaming via Next.js API routes (keeps AI API keys server-side)

### Backend (`apps/api`)
- FastAPI + Uvicorn, Python 3.12
- PostgreSQL 16 + pgvector, Redis 7
- SQLAlchemy 2.0 async, Alembic migrations
- JWT auth (HS256), sliding-window rate limiting
- AI SDK adapters: Anthropic, OpenAI, Google (server-side only)

### Mobile (`apps/mobile`)
- Expo 52, React Native 0.76, Expo Router 4
- NativeWind (Tailwind for RN), Zustand, TanStack Query
- JWT stored in expo-secure-store (not localStorage)
- SSE streaming via fetch + ReadableStream

### Desktop (`apps/desktop`)
- Tauri 2 (Rust shell) + Vite + React 19 frontend
- WebView shows the next.js web app in development
- Production bundle uses static Next.js export

## Model Routing

| Alias | Model | Use case |
|-------|-------|-----------|
| kroex-ultra | claude-opus-4-5 | Complex reasoning, coding |
| kroex-pro | claude-sonnet-4-6 | Balanced performance |
| kroex-fast | claude-haiku-4-5 | Quick responses |

Also supported: `gpt-4o`, `gpt-4o-mini`, `gemini-flash`, `gemini-pro`

## Security

- AI API keys never exposed to frontend
- Server-side secrets loaded from environment variables
- JWT auth with short expiry + refresh tokens
- Rate limiting on all API endpoints
- XSS and CSRF headers in Next.js

## Deployment

Run the full stack locally with:

```bash
docker compose up --build
```

Services: postgres:5432, redis:6379, api:8000, web:3000
