"""Question telemetry for the owner dashboard (Redis with in-memory fallback)."""

from __future__ import annotations

import json
import statistics
import time
from collections import Counter, deque

from memory.session_store import get_redis, key

MAX_KEEP = 500
_mem: deque = deque(maxlen=MAX_KEEP)


def record(entry: dict) -> None:
    entry = {"feedback": "unrated", "ts": time.time(), **entry}
    r = get_redis()
    if r is None:
        _mem.appendleft(entry)
        return
    pipe = r.pipeline()
    pipe.lpush(key("questions"), json.dumps(entry, ensure_ascii=False))
    pipe.ltrim(key("questions"), 0, MAX_KEEP - 1)
    pipe.execute()


def recent(limit: int = 100) -> list[dict]:
    r = get_redis()
    if r is None:
        return list(_mem)[:limit]
    return [json.loads(x) for x in r.lrange(key("questions"), 0, limit - 1)]


def get(question_id: str) -> dict | None:
    return next((e for e in recent(MAX_KEEP) if e.get("id") == question_id), None)


def _update(question_id: str, fn) -> dict | None:
    r = get_redis()
    if r is None:
        for i, e in enumerate(_mem):
            if e["id"] == question_id:
                out = fn(e)
                if out is None:
                    del _mem[i]
                else:
                    _mem[i] = out
                return e
        return None
    items = r.lrange(key("questions"), 0, -1)
    for raw in items:
        e = json.loads(raw)
        if e["id"] == question_id:
            out = fn(e)
            if out is None:
                r.lrem(key("questions"), 1, raw)
            else:
                idx = items.index(raw)
                r.lset(key("questions"), idx, json.dumps(out, ensure_ascii=False))
            return e
    return None


def set_feedback(question_id: str, feedback: str) -> dict | None:
    return _update(question_id, lambda e: {**e, "feedback": feedback})


def delete(question_id: str) -> dict | None:
    return _update(question_id, lambda e: None)


def _pct(values: list[float], p: float) -> float:
    if not values:
        return 0.0
    v = sorted(values)
    return round(v[min(len(v) - 1, int(round(p * (len(v) - 1))))], 1)


def stats() -> dict:
    items = recent(MAX_KEEP)
    lat = [e["latency_ms"] for e in items if not e.get("cached") and e.get("latency_ms")]
    ttft = [e["ttft_ms"] for e in items if not e.get("cached") and e.get("ttft_ms")]
    cached = [e["latency_ms"] for e in items if e.get("cached")]
    fb = Counter(e.get("feedback", "unrated") for e in items)
    routes = Counter(e.get("route", "") for e in items)
    verified = [e for e in items if (e.get("verification") or {}).get("checked")]
    calls = [len(e.get("llm_calls") or []) for e in items if not e.get("cached")]
    rated = fb["correct"] + fb["incorrect"]
    return {
        "total_questions": len(items),
        "cache_hits": len(cached),
        "cache_hit_rate": round(len(cached) / max(len(items), 1), 4),
        "latency_ms": {"p50": _pct(lat, 0.5), "p95": _pct(lat, 0.95), "mean": round(statistics.mean(lat), 1) if lat else 0},
        "ttft_ms": {"p50": _pct(ttft, 0.5), "p95": _pct(ttft, 0.95)},
        "cache_latency_ms": {"p50": _pct(cached, 0.5)},
        "feedback": dict(fb),
        "owner_accuracy": round(fb["correct"] / rated, 4) if rated else None,
        "routes": dict(routes),
        "verifier_pass_rate": round(sum(1 for e in verified if e["verification"].get("passed")) / len(verified), 4)
        if verified else None,
        "avg_llm_calls": round(statistics.mean(calls), 2) if calls else 0,
        "errors": sum(1 for e in items if e.get("error")),
    }
