"""
Per-request event bus (contextvars) — replaces the old module-global token callback that leaked
tokens across concurrent WebSocket sessions.
"""

from __future__ import annotations

import asyncio
import time
from contextvars import ContextVar
from dataclasses import dataclass, field

_current: ContextVar["EventBus | None"] = ContextVar("bkai_event_bus", default=None)


@dataclass
class EventBus:
    queue: asyncio.Queue = field(default_factory=asyncio.Queue)
    trace: list[dict] = field(default_factory=list)
    t0: float = field(default_factory=time.perf_counter)
    first_token_ms: float | None = None
    question_id: str = ""

    def emit(self, event: dict) -> None:
        event = {**event, "question_id": self.question_id, "t_ms": round((time.perf_counter() - self.t0) * 1000, 1)}
        if event.get("type") == "token":
            if self.first_token_ms is None:
                self.first_token_ms = event["t_ms"]
        else:
            self.trace.append(event)
        self.queue.put_nowait(event)


def bind(bus: EventBus):
    return _current.set(bus)


def unbind(token) -> None:
    _current.reset(token)


def emit(event: dict) -> None:
    bus = _current.get()
    if bus is not None:
        bus.emit(event)


def agent_event(agent: str, status: str, detail: str = "", **data) -> None:
    emit({"type": "agent", "agent": agent, "status": status, "detail": detail, **data})


def tool_event(agent: str, tool: str, args: dict, result_summary: str, ms: float, preview: list | None = None) -> None:
    emit({"type": "tool", "agent": agent, "tool": tool, "args": args, "result": result_summary, "ms": round(ms, 1),
          **({"preview": preview} if preview else {})})


def token(text: str) -> None:
    emit({"type": "token", "content": text})
