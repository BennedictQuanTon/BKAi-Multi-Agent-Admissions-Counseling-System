"""Live console hub: fans out per-request agent/tool events (never tokens) to dashboard sockets."""

from __future__ import annotations

from fastapi import WebSocket


class DashboardHub:
    def __init__(self) -> None:
        self.clients: set[WebSocket] = set()

    async def connect(self, ws: WebSocket) -> None:
        await ws.accept()
        self.clients.add(ws)

    def disconnect(self, ws: WebSocket) -> None:
        self.clients.discard(ws)

    async def publish(self, event: dict) -> None:
        for ws in list(self.clients):
            try:
                await ws.send_json(event)
            except Exception:  # noqa: BLE001
                self.clients.discard(ws)


hub = DashboardHub()
