"""Observability: component health, knowledge-base inventory and request analytics."""

from __future__ import annotations

import json
import os
import statistics
import time
from collections import Counter, defaultdict
from pathlib import Path

from config.settings import CURATED_DIR, DATA_DIR, DOCUMENTS_DIR, LEGACY_DIR, SOURCES_DIR, STRUCTURED_DIR, get_settings
from services.classify import CATEGORIES

STARTED_AT = time.time()


def _timed(fn):
    t = time.perf_counter()
    try:
        detail = fn()
        return {"status": "healthy", "latency_ms": round((time.perf_counter() - t) * 1000, 1), **(detail or {})}
    except Exception as e:  # noqa: BLE001
        return {"status": "down", "latency_ms": round((time.perf_counter() - t) * 1000, 1), "error": str(e)[:160]}


def health() -> dict:
    s = get_settings()
    from memory.session_store import get_redis
    from retrieval import models as rm
    from retrieval.store import get_client
    from services import audio_service
    from services.llm import pool_status

    def redis_check():
        r = get_redis()
        if r is None:
            raise RuntimeError("unreachable — using in-process fallback")
        r.ping()
        info = r.info("memory")
        return {"used_memory": info.get("used_memory_human"), "keys": r.dbsize()}

    def qdrant_check():
        c = get_client()
        info = c.get_collection(s.qdrant.collection)
        return {"mode": "server" if s.qdrant.url else "embedded", "points": info.points_count,
                "cache_points": c.get_collection(s.qdrant.cache_collection).points_count
                if c.collection_exists(s.qdrant.cache_collection) else 0}

    def facts_check():
        from knowledge.facts import query

        return {"majors": query("SELECT COUNT(*) n FROM majors")[0]["n"],
                "scores": query("SELECT COUNT(*) n FROM admission_scores")[0]["n"]}

    def loaded(cache_fn) -> bool:
        try:
            return cache_fn.cache_info().currsize > 0
        except Exception:  # noqa: BLE001
            return False

    pool = pool_status()
    llm_status = "healthy" if any(p["cooldown_s"] == 0 for p in pool) else "degraded"
    components = {
        "api": {"status": "healthy", "uptime_s": round(time.time() - STARTED_AT), "version": s.app.version, "pid": os.getpid()},
        "redis": _timed(redis_check),
        "qdrant": _timed(qdrant_check),
        "facts_db": _timed(facts_check),
        "gemini": {"status": llm_status, "pool": pool},
        "embedder": {"status": "healthy" if loaded(rm.get_embedder) else "cold", "model": s.embedding.model},
        "reranker": {"status": "healthy" if loaded(rm.get_reranker) else "cold", "model": s.reranker.model},
        "tts_kokoro": {"status": "healthy" if loaded(audio_service._kokoro) else "cold", "provider": s.voice.tts_provider},
        "stt_assemblyai": {"status": "configured" if s.assemblyai.enabled else "not_configured",
                           "model": s.assemblyai.speech_model, **audio_service.stt_stats()},
        "stt_whisper": {"status": "healthy" if loaded(audio_service._whisper) else "cold (lazy)"},
        "livekit": {"status": "configured" if s.livekit.enabled else "not_configured"},
    }
    return components


def inventory() -> dict:
    def count(path: Path, pattern: str = "*") -> int:
        return len([p for p in path.rglob(pattern) if p.is_file()]) if path.exists() else 0

    snaps = sorted(p for p in SOURCES_DIR.glob("*") if (p / "manifest.json").exists())
    snapshot = {}
    if snaps:
        man = json.loads((snaps[-1] / "manifest.json").read_text(encoding="utf-8"))
        snapshot = {"date": snaps[-1].name, "pages": len([m for m in man if "error" not in m]),
                    "failed": len([m for m in man if "error" in m]), "html_tables": sum(m.get("tables", 0) for m in man),
                    "chars": sum(m.get("chars", 0) for m in man), "assets": count(snaps[-1] / "assets")}
    tables = {}
    for f in sorted(STRUCTURED_DIR.glob("*.csv")):
        with f.open(encoding="utf-8") as fh:
            tables[f.stem] = max(sum(1 for _ in fh) - 1, 0)
    docs = {d.name: count(d, "*.md") for d in DOCUMENTS_DIR.iterdir() if d.is_dir()} if DOCUMENTS_DIR.exists() else {}
    by_ext = Counter(p.suffix.lower().lstrip(".") for p in DATA_DIR.rglob("*") if p.is_file()
                     and p.suffix.lower() in (".csv", ".md", ".pdf", ".docx", ".html", ".json", ".png"))
    legacy = Counter(p.suffix.lower().lstrip(".") for p in LEGACY_DIR.rglob("*") if p.is_file() and not p.name.startswith("."))
    s = get_settings()
    manifest = json.loads(s.manifest_path.read_text(encoding="utf-8")) if s.manifest_path.exists() else {}
    return {"snapshot": snapshot, "structured_tables": tables, "documents": docs, "files_by_type": dict(by_ext),
            "legacy_files": dict(legacy), "kb_version": manifest.get("kb_version"), "built_at": manifest.get("built_at"),
            "curated_dir": str(CURATED_DIR.relative_to(DATA_DIR.parent))}


def _pct(values: list[float], p: float) -> float | None:
    v = sorted(x for x in values if x is not None)
    return round(v[min(len(v) - 1, int(round(p * (len(v) - 1))))], 1) if v else None


def analytics(items: list[dict]) -> dict:
    llm_items = [e for e in items if not e.get("cached") and e.get("route") not in ("guardrail", "cache")]
    lat = [e["latency_ms"] for e in llm_items if e.get("latency_ms")]
    ttft = [e.get("ttft_ms") for e in llm_items]
    tpot = [e.get("tpot_ms") for e in llm_items]
    conf = [e["confidence"] for e in items if e.get("confidence") is not None]
    per_model: dict[str, dict] = defaultdict(lambda: {"calls": 0, "in_tokens": 0, "out_tokens": 0, "ms": []})
    for e in items:
        for c in e.get("llm_calls") or []:
            m = per_model[c.get("model") or "?"]
            m["calls"] += 1
            m["in_tokens"] += c.get("in_tokens") or 0
            m["out_tokens"] += c.get("out_tokens") or 0
            if c.get("ms"):
                m["ms"].append(c["ms"])
    models = {k: {"calls": v["calls"], "in_tokens": v["in_tokens"], "out_tokens": v["out_tokens"],
                  "p50_ms": _pct(v["ms"], .5)} for k, v in per_model.items()}
    fb = Counter(e.get("feedback", "unrated") for e in items if e.get("route") != "guardrail")
    stage_ms: dict[str, list[float]] = defaultdict(list)
    for e in llm_items:
        for k, v in (e.get("timings") or {}).items():
            if k.endswith("_ms") and isinstance(v, (int, float)):
                stage_ms[k[:-3]].append(v)
    return {
        "requests": len(items),
        "latency_ms": {"p50": _pct(lat, .5), "p90": _pct(lat, .9), "p95": _pct(lat, .95), "p99": _pct(lat, .99)},
        "ttft_ms": {"p50": _pct(ttft, .5), "p95": _pct(ttft, .95)},
        "tpot_ms": {"p50": _pct(tpot, .5), "p95": _pct(tpot, .95)},
        "confidence": {"mean": round(statistics.mean(conf), 3) if conf else None, "n": len(conf)},
        "tokens": {"in": sum(e.get("in_tokens") or 0 for e in items), "out": sum(e.get("out_tokens") or 0 for e in items)},
        "models": models,
        "categories": {CATEGORIES.get(k, k): v for k, v in Counter(e.get("category", "khac") for e in items).most_common()},
        "routes": dict(Counter(e.get("route", "") for e in items)),
        "accuracy": {"correct": fb.get("correct", 0), "incorrect": fb.get("incorrect", 0), "unreviewed": fb.get("unrated", 0)},
        "user_feedback": dict(Counter(e.get("user_feedback") for e in items if e.get("user_feedback"))),
        "verifier_pass_rate": (lambda v: round(sum(v) / len(v), 4) if v else None)(
            [1 if (e.get("verification") or {}).get("passed") else 0 for e in llm_items if (e.get("verification") or {}).get("checked")]),
        "cache_hit_rate": round(sum(1 for e in items if e.get("cached")) / max(len(items), 1), 4),
        "errors": sum(1 for e in items if e.get("error")),
        "stage_p50_ms": {k: _pct(v, .5) for k, v in stage_ms.items()},
        "series": [{k: e.get(k) for k in ("id", "ts", "latency_ms", "ttft_ms", "tpot_ms", "confidence", "in_tokens",
                                          "out_tokens", "route", "category", "feedback", "cached", "channel")}
                   | {"query": (e.get("query") or "")[:80]} for e in reversed(items)],
    }
