"""
Conversation memory + student profile per session.

Redis-backed (survives restarts, shared by every API worker, TTL-expired) with an in-process
fallback when Redis is unavailable (local dev / tests).
"""

from __future__ import annotations

import json
import time
from functools import lru_cache

import redis

from config.settings import get_settings
from memory.student_profile import StudentProfile
from utils.logger import get_logger

logger = get_logger(__name__)
MAX_TURNS = 12


@lru_cache(maxsize=1)
def get_redis() -> redis.Redis | None:
    s = get_settings().redis
    try:
        r = redis.Redis.from_url(s.url, decode_responses=True, socket_timeout=1.5, socket_connect_timeout=1.5)
        r.ping()
        return r
    except Exception as e:  # noqa: BLE001
        logger.warning("redis_unavailable_using_memory", error=str(e))
        return None


def key(*parts: str) -> str:
    return ":".join([get_settings().redis.prefix, *parts])


class SessionStore:
    def __init__(self) -> None:
        self._mem_hist: dict[str, list[dict]] = {}
        self._mem_prof: dict[str, dict] = {}

    def history(self, sid: str) -> list[dict]:
        r = get_redis()
        if r is None:
            return list(self._mem_hist.get(sid, []))
        return [json.loads(x) for x in r.lrange(key("sess", sid, "hist"), 0, -1)]

    def add_turn(self, sid: str, role: str, content: str) -> None:
        turn = {"role": role, "content": content, "ts": time.time()}
        r = get_redis()
        if r is None:
            hist = self._mem_hist.setdefault(sid, [])
            hist.append(turn)
            del hist[:-MAX_TURNS]
            return
        k = key("sess", sid, "hist")
        pipe = r.pipeline()
        pipe.rpush(k, json.dumps(turn, ensure_ascii=False))
        pipe.ltrim(k, -MAX_TURNS, -1)
        pipe.expire(k, get_settings().redis.session_ttl)
        pipe.execute()

    def profile(self, sid: str) -> StudentProfile:
        r = get_redis()
        raw = self._mem_prof.get(sid) if r is None else (json.loads(r.get(key("sess", sid, "profile")) or "{}"))
        return StudentProfile.model_validate(raw or {})

    def update_profile(self, sid: str, patch: dict) -> StudentProfile:
        prof = self.profile(sid).merge(patch)
        r = get_redis()
        if r is None:
            self._mem_prof[sid] = prof.model_dump()
        else:
            r.set(key("sess", sid, "profile"), prof.model_dump_json(), ex=get_settings().redis.session_ttl)
        return prof

    def clear(self, sid: str) -> None:
        r = get_redis()
        self._mem_hist.pop(sid, None)
        self._mem_prof.pop(sid, None)
        if r is not None:
            r.delete(key("sess", sid, "hist"), key("sess", sid, "profile"))

    def active_sessions(self) -> int:
        r = get_redis()
        if r is None:
            return len(self._mem_hist)
        return sum(1 for _ in r.scan_iter(key("sess", "*", "hist"), count=500))


_store = SessionStore()


def get_session_store() -> SessionStore:
    return _store
