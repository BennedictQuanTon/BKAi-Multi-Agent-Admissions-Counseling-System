"""Production smoke test: run against a deployment (or a local APP_ENV=production backend behind `vite preview`).

    backend/.venv/bin/python scripts/smoke_prod.py --base https://bkai.example.com --admin-token $ADMIN_TOKEN
    backend/.venv/bin/python scripts/smoke_prod.py --base http://localhost:4173 --admin-token test-token

Checks that the public surface is open, the owner surface is closed, and one real question works end to end.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import sys

import httpx
import websockets


async def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", required=True)
    ap.add_argument("--admin-token", default="")
    args = ap.parse_args()
    base = args.base.rstrip("/")
    ws_base = base.replace("https://", "wss://").replace("http://", "ws://")
    ok = True

    def check(name: str, cond: bool, detail: str = "") -> None:
        nonlocal ok
        ok &= cond
        print(f"{'✓' if cond else '✗'} {name}{f'  ({detail})' if detail else ''}")

    async with httpx.AsyncClient(timeout=30, follow_redirects=False) as c:
        r = await c.get(f"{base}/")
        check("landing / serves the app", r.status_code == 200 and "<div id=\"root\">" in r.text)
        r = await c.get(f"{base}/chat")
        check("/chat serves the app (SPA fallback)", r.status_code == 200)
        h = await c.get(f"{base}/api/health")
        check("health ok", h.status_code == 200 and h.json().get("status") == "ok", h.text[:80])
        for k in ("x-content-type-options", "referrer-policy"):
            check(f"header {k}", k in h.headers)
        docs = await c.get(f"{base}/docs")
        spec = await c.get(f"{base}/openapi.json")
        check("API docs not exposed", "swagger" not in docs.text.lower() and not spec.text.lstrip().startswith("{"))
        check("observability needs the admin token", (await c.get(f"{base}/api/observability/overview")).status_code == 401)
        check("question list needs the admin token", (await c.get(f"{base}/api/questions")).status_code == 401)
        if args.admin_token:
            r = await c.get(f"{base}/api/stats", headers={"X-Admin-Token": args.admin_token})
            check("admin token accepted", r.status_code == 200)
        check("malformed session id rejected", (await c.get(f"{base}/api/session/a%20b")).status_code == 422)
        r = await c.get(f"{base}/media/trailer/bkai-trailer-web.mp4", headers={"Range": "bytes=0-1023"})
        check("film streams with byte ranges", r.status_code == 206)

    origin = base
    try:
        async with websockets.connect(f"{ws_base}/ws/chat") as ws:
            await ws.send(json.dumps({"query": "hi", "session_id": "smoke-no-origin"}))
            await asyncio.wait_for(ws.recv(), 5)
        check("WebSocket without Origin refused", False, "connection was accepted")
    except Exception:
        check("WebSocket without Origin refused", True)

    answer, sources = "", 0
    async with websockets.connect(f"{ws_base}/ws/chat", origin=origin) as ws:
        await ws.send(json.dumps({"query": "Điểm chuẩn ngành Khoa học Máy tính năm 2026 là bao nhiêu?", "session_id": "smoke-test-001"}))
        while True:
            ev = json.loads(await asyncio.wait_for(ws.recv(), 90))
            if ev["type"] == "done":
                answer, sources = ev.get("answer", ""), len(ev.get("sources") or [])
                break
            if ev["type"] == "error":
                break
    check("real question answered with the official number", "85.45" in answer or "85,45" in answer, f"{sources} sources")
    print("\nALL GOOD" if ok else "\nSOME CHECKS FAILED")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
