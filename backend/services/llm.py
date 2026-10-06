"""
Quota-aware Gemini router.

Every model has its own sliding-window limiter (free tier: 15 RPM / model / project). Calls go to the
primary model (gemini-3.5-flash-lite) and fail over to the next model in the pool when its window is
full or the API answers 429/503 — before any token has been streamed to the user.
"""

from __future__ import annotations

import asyncio
import re
import time
from collections import deque
from collections.abc import AsyncIterator
from dataclasses import dataclass, field
from functools import lru_cache
from typing import TypeVar

from langchain_core.messages import BaseMessage
from langchain_google_genai import ChatGoogleGenerativeAI
from pydantic import BaseModel

from config.settings import get_settings
from services.events import emit
from utils.logger import get_logger

logger = get_logger(__name__)
T = TypeVar("T", bound=BaseModel)
WINDOW_S = 60.0


class LLMUnavailable(RuntimeError):
    pass


@dataclass
class _ModelSlot:
    name: str
    rpm: int
    calls: deque = field(default_factory=deque)
    cooldown_until: float = 0.0

    def free_in(self, now: float) -> float:
        """Seconds until this model can take another request (0 = now)."""
        while self.calls and now - self.calls[0] >= WINDOW_S:
            self.calls.popleft()
        wait = max(0.0, self.cooldown_until - now)
        if len(self.calls) >= self.rpm:
            wait = max(wait, WINDOW_S - (now - self.calls[0]) + 0.05)
        return wait


class ModelPool:
    def __init__(self, models: list[str], rpm: int) -> None:
        self.slots = [_ModelSlot(m, rpm) for m in dict.fromkeys(models)]
        self._lock = asyncio.Lock()

    async def acquire(self, max_wait: float = 20.0) -> _ModelSlot:
        """Pick the first model (pool order = preference) that is free; otherwise wait for the soonest."""
        deadline = time.monotonic() + max_wait
        while True:
            async with self._lock:
                now = time.monotonic()
                waits = [(s.free_in(now), i, s) for i, s in enumerate(self.slots)]
                ready = [s for w, _, s in waits if w == 0]
                if ready:
                    ready[0].calls.append(now)
                    return ready[0]
                soonest = min(w for w, _, _ in waits)
            if time.monotonic() + soonest > deadline:
                raise LLMUnavailable("all Gemini models are rate-limited")
            await asyncio.sleep(min(soonest, 2.0))

    def penalize(self, slot: _ModelSlot, error: Exception) -> None:
        msg = str(error)
        m = re.search(r"retry in ([\d.]+)s|retryDelay['\": ]+(\d+)s", msg)
        delay = float(next(g for g in m.groups() if g)) if m else (30.0 if "429" in msg else 10.0)
        slot.cooldown_until = time.monotonic() + delay
        logger.warning("llm_model_cooldown", model=slot.name, seconds=round(delay, 1), error=msg[:120])


def _retryable(e: Exception) -> bool:
    s = str(e)
    return any(code in s for code in ("429", "503", "RESOURCE_EXHAUSTED", "UNAVAILABLE", "500", "DEADLINE"))


@lru_cache(maxsize=1)
def get_pool() -> ModelPool:
    g = get_settings().gemini
    return ModelPool([g.model_primary, *g.fallback_list], g.rpm_per_model)


@lru_cache(maxsize=8)
def _client(model: str, temperature: float) -> ChatGoogleGenerativeAI:
    s = get_settings()
    return ChatGoogleGenerativeAI(
        model=model,
        google_api_key=s.google.api_key,
        temperature=temperature,
        timeout=s.gemini.request_timeout,
        max_retries=0,  # failover is handled by the pool, not by blind retries
        thinking_level="minimal",
    )


def _usage_add(acc: dict, usage) -> None:
    if usage:
        acc["in_tokens"] = acc.get("in_tokens", 0) + int(usage.get("input_tokens") or 0)
        acc["out_tokens"] = acc.get("out_tokens", 0) + int(usage.get("output_tokens") or 0)


def _report(node: str, model: str, t0: float, first: float | None, usage: dict, meta: dict | None,
            attempt: int, error: str = "") -> None:
    """Per-call inference metrics → meta (for telemetry) + an `llm` event (live console)."""
    total_ms = (time.perf_counter() - t0) * 1000
    out = usage.get("out_tokens", 0)
    streamed = first is not None  # structured calls return in one piece: no TTFT / TPOT to report
    ttft_ms = (first - t0) * 1000 if streamed else None
    gen_ms = max(total_ms - (ttft_ms or 0.0), 0.0)
    rec = {"node": node, "model": model, "attempt": attempt, "ttft_ms": round(ttft_ms, 1) if streamed else None,
           "ms": round(total_ms, 1), "in_tokens": usage.get("in_tokens", 0), "out_tokens": out,
           "tpot_ms": round(gen_ms / (out - 1), 2) if streamed and out > 1 else None,
           "tokens_per_s": round(out / (total_ms / 1000), 1) if out and total_ms else None}
    if error:
        rec["error"] = error[:160]
    if meta is not None:
        meta.update({k: v for k, v in rec.items() if k != "node"})
    emit({"type": "llm", **rec})


def _text(content) -> str:
    if isinstance(content, list):
        return "".join(b.get("text", "") if isinstance(b, dict) else str(b) for b in content)
    return str(content or "")


async def structured(schema: type[T], messages: list[BaseMessage], temperature: float | None = None,
                     meta: dict | None = None, node: str = "structured") -> T:
    """Structured output with model failover. `meta` receives model, latency and token usage."""
    temp = get_settings().gemini.temperature_fast if temperature is None else temperature
    pool = get_pool()
    last: Exception | None = None
    for attempt in range(1, len(pool.slots) + 2):
        slot = await pool.acquire()
        t0 = time.perf_counter()
        try:
            res = await _client(slot.name, temp).with_structured_output(schema, include_raw=True).ainvoke(messages)
            usage: dict = {}
            _usage_add(usage, getattr(res.get("raw"), "usage_metadata", None))
            _report(node, slot.name, t0, None, usage, meta, attempt)
            if res.get("parsed") is None:
                raise ValueError(f"structured output parse error: {res.get('parsing_error')}")
            return res["parsed"]
        except Exception as e:  # noqa: BLE001
            last = e
            if not _retryable(e):
                raise
            _report(node, slot.name, t0, None, {}, None, attempt, error=str(e))
            pool.penalize(slot, e)
    raise LLMUnavailable(str(last))


async def stream(messages: list[BaseMessage], temperature: float | None = None,
                 meta: dict | None = None, node: str = "stream") -> AsyncIterator[str]:
    """Token stream with failover allowed only before the first token is emitted."""
    temp = get_settings().gemini.temperature_primary if temperature is None else temperature
    pool = get_pool()
    last: Exception | None = None
    for attempt in range(1, len(pool.slots) + 2):
        slot = await pool.acquire()
        started = False
        t0 = time.perf_counter()
        first: float | None = None
        usage: dict = {}
        try:
            async for chunk in _client(slot.name, temp).astream(messages):
                _usage_add(usage, chunk.usage_metadata)  # Gemini reports per-chunk deltas
                text = _text(chunk.content)
                if text:
                    if first is None:
                        first = time.perf_counter()
                    started = True
                    yield text
            _report(node, slot.name, t0, first, usage, meta, attempt)
            return
        except Exception as e:  # noqa: BLE001
            last = e
            if started or not _retryable(e):
                raise
            _report(node, slot.name, t0, first, usage, None, attempt, error=str(e))
            pool.penalize(slot, e)
    raise LLMUnavailable(str(last))


async def complete(messages: list[BaseMessage], temperature: float | None = None, meta: dict | None = None,
                   node: str = "complete") -> str:
    return "".join([t async for t in stream(messages, temperature, meta, node)])


def pool_status() -> list[dict]:
    """Live view of the model pool for the health panel."""
    now = time.monotonic()
    return [{"model": s.name, "calls_last_min": len([t for t in s.calls if now - t < WINDOW_S]), "rpm_limit": s.rpm,
             "cooldown_s": round(max(0.0, s.cooldown_until - now), 1)} for s in get_pool().slots]
