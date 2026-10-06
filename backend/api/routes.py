"""REST API."""

from __future__ import annotations

import asyncio
import json
from collections.abc import AsyncIterator

from fastapi import APIRouter, Depends, HTTPException, Path
from fastapi.responses import StreamingResponse

from api.hub import hub
from api.schemas import (SESSION_ID, AdminDeleteRequest, AdminReviewRequest, CalcRequest, ChatRequest, ChatResponse,
                         FeedbackRequest, SessionRequest, TTSRequest)
from api.security import rate_limit, require_admin
from config.settings import get_settings
from knowledge import facts
from memory import answer_cache, telemetry
from memory.session_store import get_redis, get_session_store
from services.chat_service import run_chat

router = APIRouter(prefix="/api")


async def stream_with_hub(query: str, session_id: str, channel: str) -> AsyncIterator[dict]:
    """Every request's agent/tool events are mirrored to the owner live console."""
    async for ev in run_chat(query, session_id, channel):
        if ev["type"] != "token":
            await hub.publish({**ev, "query": ev.get("query", query), "session_id": session_id})
        yield ev


@router.post("/chat", response_model=ChatResponse, dependencies=[Depends(rate_limit)])
async def chat(req: ChatRequest) -> ChatResponse:
    final: dict = {}
    async for ev in stream_with_hub(req.query, req.session_id, req.channel):
        if ev["type"] in ("done", "error"):
            final = ev
    if final.get("type") == "error":
        raise HTTPException(status_code=503, detail=final.get("message"))
    return ChatResponse(**{k: v for k, v in final.items() if k in ChatResponse.model_fields})


@router.post("/session/clear", dependencies=[Depends(rate_limit)])
async def clear_session(req: SessionRequest) -> dict:
    get_session_store().clear(req.session_id)
    return {"status": "ok"}


@router.get("/session/{session_id}", dependencies=[Depends(rate_limit)])
async def session_state(session_id: str = Path(..., pattern=SESSION_ID)) -> dict:
    store = get_session_store()
    return {"history": store.history(session_id), "profile": store.profile(session_id).model_dump()}


@router.post("/feedback")
async def feedback(req: FeedbackRequest) -> dict:
    found = telemetry._update(req.question_id, lambda e: {**e, "user_feedback": req.feedback})
    return {"status": "ok" if found else "not_found"}


@router.post("/tools/calc", dependencies=[Depends(rate_limit)])
async def calc(req: CalcRequest) -> dict:
    """Deterministic counselling tool used by the UI calculator (no LLM)."""
    res = facts.compute_admission_score(req.thpt_math, req.thpt_subject2, req.thpt_subject3, req.hocba_math,
                                        req.hocba_subject2, req.hocba_subject3, req.dgnl, req.bonus_points,
                                        req.priority_points_30)
    major_ids = facts.resolve(" ".join(req.interests)).major_ids if req.interests else None
    rec = facts.recommend_majors(res["diem_xet_tuyen"], major_ids, req.program_ids or None, limit=12)
    return {"score": res, "recommendations": rec}


@router.get("/majors")
async def majors(program_id: str | None = None) -> dict:
    rows = facts.list_majors([program_id] if program_id else None)
    programs = facts.query("SELECT program_id, name FROM programs")
    return {"majors": rows, "programs": programs}


@router.get("/kb")
async def kb() -> dict:
    s = get_settings()
    manifest = json.loads(s.manifest_path.read_text(encoding="utf-8")) if s.manifest_path.exists() else {}
    return {"manifest": manifest, "latest_year": facts.latest_year()}


@router.get("/eval", dependencies=[Depends(require_admin)])
async def eval_reports() -> dict:
    """Latest offline/online benchmark reports (evaluation/reports/*.json) for the dashboard."""
    from pathlib import Path

    base = Path(__file__).resolve().parent.parent / "evaluation" / "reports"

    def load(name: str):
        p = base / name
        return json.loads(p.read_text(encoding="utf-8")) if p.exists() else None

    retrieval = load("retrieval_bench.json") or {}
    e2e = load("e2e_bench.json") or {}
    intel = load("tts_intelligibility.json") or {}
    return {"retrieval": [{k: r[k] for k in ("config", "hit@1", "hit@5", "mrr@10", "ndcg@10", "latency_ms_p50")}
                          for r in retrieval.get("results", [])],
            "e2e": {"summary": e2e.get("summary"), "generated_at": e2e.get("generated_at"),
                    "cases8": [{"id": c["id"], "tier": c["tier"], "ok": c["ok"],
                                "turns": [{k: t.get(k) for k in ("q", "route", "latency_ms", "ttft_ms", "reasons")}
                                          for t in c["turns"]]} for c in (e2e.get("cases8") or {}).get("results", [])]},
            "tts": load("tts_bench.json"), "tts_intelligibility": intel.get("summary")}


@router.get("/observability/overview", dependencies=[Depends(require_admin)])
async def observability_overview(limit: int = 200) -> dict:
    from api.hub import hub
    from services import observability

    items = telemetry.recent(min(max(limit, 1), 500))
    health = await asyncio.to_thread(observability.health)
    return {"generated_at": __import__("time").time(), "health": health, "inventory": observability.inventory(),
            "analytics": observability.analytics(items), "live_clients": len(hub.clients),
            "active_sessions": get_session_store().active_sessions()}


@router.get("/observability/query/{question_id}", dependencies=[Depends(require_admin)])
async def observability_query(question_id: str) -> dict:
    item = telemetry.get(question_id)
    if not item:
        raise HTTPException(status_code=404, detail="question not found")
    return item


@router.get("/stats", dependencies=[Depends(require_admin)])
async def stats() -> dict:
    return {**telemetry.stats(), "active_sessions": get_session_store().active_sessions()}


@router.get("/questions", dependencies=[Depends(require_admin)])
async def questions(limit: int = 100) -> dict:
    return {"items": telemetry.recent(min(limit, 500))}


@router.post("/admin/review", dependencies=[Depends(require_admin)])
async def admin_review(req: AdminReviewRequest) -> dict:
    entry = telemetry.set_feedback(req.question_id, req.verdict)
    if not entry:
        raise HTTPException(status_code=404, detail="question not found")
    cache_status = await asyncio.to_thread(answer_cache.set_status, req.question_id,
                                           "approved" if req.verdict == "correct" else "rejected")
    return {"status": "ok", "cache_updated": cache_status}


@router.post("/admin/delete", dependencies=[Depends(require_admin)])
async def admin_delete(req: AdminDeleteRequest) -> dict:
    telemetry.delete(req.question_id)
    await asyncio.to_thread(answer_cache.delete, req.question_id)
    return {"status": "ok"}


@router.post("/voice/tts")
async def tts(req: TTSRequest) -> StreamingResponse:
    from services.audio_service import tts_stream

    return StreamingResponse(tts_stream(req.text), media_type="audio/mpeg")


@router.get("/voice/config")
async def voice_config() -> dict:
    s = get_settings()
    return {"stt": "assemblyai" if s.assemblyai.enabled else "whisper", "tts": s.voice.tts_provider,
            "livekit": s.livekit.enabled, "sample_rate": s.assemblyai.sample_rate}


@router.get("/health")
async def health() -> dict:
    s = get_settings()
    from retrieval.store import get_client

    try:
        qdrant_ok = get_client().collection_exists(s.qdrant.collection)
    except Exception:  # noqa: BLE001
        qdrant_ok = False
    return {"status": "ok", "version": s.app.version, "llm": [s.gemini.model_primary, *s.gemini.fallback_list],
            "embedding": s.embedding.model, "reranker": s.reranker.model, "qdrant": qdrant_ok,
            "redis": get_redis() is not None, "kb_version": answer_cache.kb_version()}
