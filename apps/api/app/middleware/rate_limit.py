import time
from collections import defaultdict
from fastapi import Request, HTTPException, status
from starlette.middleware.base import BaseHTTPMiddleware
from ..config import get_settings

settings = get_settings()

class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, calls: int = 60, period: int = 60):
        super().__init__(app)
        self.calls = calls
        self.period = period
        self._store: dict[str, list[float]] = defaultdict(list)

    async def dispatch(self, request: Request, call_next):
        # Skip rate limiting for non-API paths and health check
        if not request.url.path.startswith('/api') or request.url.path == '/api/health':
            return await call_next(request)

        client_ip = request.client.host if request.client else '0.0.0.0'
        now = time.time()
        window_start = now - self.period

        # Clean old entries
        self._store[client_ip] = [t for t in self._store[client_ip] if t > window_start]

        if len(self._store[client_ip]) >= self.calls:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail='Rate limit exceeded. Please wait before making more requests.',
                headers={'Retry-After': str(self.period)},
            )

        self._store[client_ip].append(now)
        return await call_next(request)
