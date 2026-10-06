"""
API protection (OWASP LLM 2026: unbounded consumption · sensitive information disclosure · prompt injection).

- client IP: X-Forwarded-For is trusted only when the direct peer is a configured reverse proxy
- quotas: per-IP fixed windows per minute and per day (Redis, in-memory fallback)
- WebSockets: Origin allow-list (CORS does not apply to WS) + max concurrent sockets per IP
- admin & observability: X-Admin-Token header (or ?token= for WebSockets); mandatory in production
- security headers + request-size limit middleware
"""

from __future__ import annotations

import hmac
import socket
import time
from collections import defaultdict
from functools import lru_cache

from fastapi import Header, HTTPException, Query, Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

from config.settings import get_settings
from memory.session_store import get_redis, key

_mem: dict[str, list[float]] = defaultdict(list)
_ws_open: dict[str, int] = defaultdict(int)


@lru_cache(maxsize=1)
def _trusted_proxy_ips() -> frozenset[str]:
    """TRUSTED_PROXIES accepts IPs or service hostnames (e.g. `caddy` on the compose network)."""
    out: set[str] = set()
    for entry in (p.strip() for p in get_settings().security.trusted_proxies.split(",") if p.strip()):
        try:
            out.update(i[4][0] for i in socket.getaddrinfo(entry, None))
        except OSError:
            out.add(entry)
    return frozenset(out)


def client_ip(conn) -> str:
    peer = conn.client.host if conn.client else "unknown"
    fwd = conn.headers.get("x-forwarded-for", "")
    if fwd and peer in _trusted_proxy_ips():
        return fwd.split(",")[0].strip()
    return peer


def _hit(ip: str, window: str, seconds: int, limit: int) -> bool:
    r = get_redis()
    bucket = int(time.time() // seconds)
    if r is None:
        k = f"{window}:{ip}:{bucket}"
        _mem[k].append(time.time())
        return len(_mem[k]) <= limit
    k = key("rl", window, ip, str(bucket))
    n = r.incr(k)
    if n == 1:
        r.expire(k, seconds + 10)
    return n <= limit


def allow(ip: str) -> bool:
    s = get_settings().security
    return _hit(ip, "min", 60, s.rate_limit_per_minute) and _hit(ip, "day", 86400, s.rate_limit_per_day)


async def rate_limit(request: Request) -> None:
    if not allow(client_ip(request)):
        raise HTTPException(status_code=429, detail="Bạn hỏi hơi nhanh, đợi một chút rồi thử lại nhé.")


def _token_ok(token: str) -> bool:
    expected = get_settings().security.admin_token
    if not expected:
        return not get_settings().app.production   # dev: open · production without a token: closed
    return hmac.compare_digest(token or "", expected)


async def require_admin(x_admin_token: str = Header(default="")) -> None:
    if not _token_ok(x_admin_token):
        raise HTTPException(status_code=401, detail="admin token required")


def ws_admin_ok(token: str = Query(default="")) -> bool:
    return _token_ok(token)


def ws_origin_ok(ws) -> bool:
    origin = ws.headers.get("origin")
    if origin is None:  # non-browser clients (benchmarks, MCP bridges) — allowed outside production only
        return not get_settings().app.production
    return origin in get_settings().api.cors_origin_list


class WSSlot:
    """Context manager limiting concurrent WebSockets per IP."""

    def __init__(self, ip: str) -> None:
        self.ip = ip
        self.ok = False

    def __enter__(self) -> bool:
        self.ok = _ws_open[self.ip] < get_settings().security.max_ws_per_ip
        if self.ok:
            _ws_open[self.ip] += 1
        return self.ok

    def __exit__(self, *exc) -> None:
        if self.ok:
            _ws_open[self.ip] = max(0, _ws_open[self.ip] - 1)


SECURITY_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), geolocation=(), microphone=(self)",
    "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
    "Cross-Origin-Opener-Policy": "same-origin",
}


class SecurityMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        limit = get_settings().security.max_body_bytes
        if int(request.headers.get("content-length") or 0) > limit:
            return JSONResponse({"detail": "request too large"}, status_code=413)
        response = await call_next(request)
        for k, v in SECURITY_HEADERS.items():
            response.headers.setdefault(k, v)
        if get_settings().app.production:
            response.headers.setdefault("Strict-Transport-Security", "max-age=63072000; includeSubDomains")
        return response
