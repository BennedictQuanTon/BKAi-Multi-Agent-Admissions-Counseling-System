"""WebSocket endpoints: streaming chat + owner live console."""

from __future__ import annotations

import json

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from api.hub import hub
from api.routes import stream_with_hub
from api.security import WSSlot, allow, client_ip, ws_admin_ok, ws_origin_ok
from utils.logger import get_logger

logger = get_logger(__name__)
ws_router = APIRouter()


@ws_router.websocket("/ws/chat")
async def ws_chat(ws: WebSocket) -> None:
    if not ws_origin_ok(ws):
        await ws.close(code=1008)
        return
    with WSSlot(client_ip(ws)) as ok:
        if not ok:
            await ws.close(code=1013)
            return
        await ws.accept()
        await _chat_loop(ws)


async def _chat_loop(ws: WebSocket) -> None:
    try:
        while True:
            try:
                data = json.loads(await ws.receive_text())
            except json.JSONDecodeError:
                await ws.send_json({"type": "error", "message": "Invalid JSON"})
                continue
            query = (data.get("query") or "").strip()
            if not query:
                await ws.send_json({"type": "error", "message": "Empty query"})
                continue
            if not allow(client_ip(ws)):
                await ws.send_json({"type": "error", "message": "Bạn hỏi hơi nhanh, đợi một chút nhé."})
                continue
            async for ev in stream_with_hub(query, data.get("session_id") or "default", data.get("channel") or "chat"):
                await ws.send_json(ev)
    except WebSocketDisconnect:
        pass
    except Exception as e:  # noqa: BLE001
        logger.warning("ws_chat_error", error=str(e))


@ws_router.websocket("/ws/dashboard")
async def ws_dashboard(ws: WebSocket, token: str = "") -> None:
    if not ws_origin_ok(ws) or not ws_admin_ok(token):
        await ws.close(code=1008)
        return
    await hub.connect(ws)
    try:
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        hub.disconnect(ws)
