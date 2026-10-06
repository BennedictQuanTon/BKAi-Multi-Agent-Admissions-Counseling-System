"""
One request pipeline shared by REST, WebSocket and voice:

  sanitize → guardrails → (cold session) entity-guarded cache → multi-agent graph → memory + telemetry

`run_chat` is an async generator of UI events: agent / tool / sources / token / replace / done.
"""

from __future__ import annotations

import asyncio
import time
import uuid
from collections.abc import AsyncIterator

from config.prompts import REFUSAL_OFF_TOPIC, REFUSAL_OTHER_UNI
from memory import answer_cache, telemetry
from memory.session_store import get_session_store
from services.events import EventBus, agent_event, bind, emit, token, unbind
from services.classify import classify, confidence
from services.guardrails import Decision, check
from services.pii import redact
from utils.logger import get_logger
from utils.text_cleaning import sanitize_input
from workflows.graph import get_graph

logger = get_logger(__name__)


async def _pipeline(query: str, session_id: str, channel: str, qid: str, bus: EventBus) -> None:
    t0 = time.perf_counter()
    store = get_session_store()
    history = store.history(session_id)
    entry: dict = {"id": qid, "query": query, "session_id": session_id, "channel": channel}
    try:
        guard = check(query)
        agent_event("guard", "done", f"{guard.decision.value} · {guard.reason}")
        if guard.decision == Decision.REJECT:
            answer = REFUSAL_OTHER_UNI if guard.reason == "other_university" else REFUSAL_OFF_TOPIC
            token(answer)
            result = {"answer": answer, "route": "guardrail", "sources": [], "verification": {"checked": False}}
        else:
            hit = await asyncio.to_thread(answer_cache.lookup, query) if not history else None
            if hit:
                agent_event("cache", "done", f"cache hit (sim={hit['similarity']})", **hit)
                emit({"type": "sources", "sources": hit["sources"]})
                token(hit["answer"])
                result = {"answer": hit["answer"], "route": "cache", "sources": hit["sources"],
                          "verification": {"checked": False, "passed": True}, "cache": hit}
                entry["cached"] = True
            else:
                state = await get_graph().ainvoke({
                    "query": query, "session_id": session_id, "channel": channel, "history": history,
                    "guard": guard.decision.value,
                    "profile": store.profile(session_id).model_dump(),
                    "profile_summary": store.profile(session_id).summary_vi(),
                })
                from agents.synthesizer import sources_payload

                store.update_profile(session_id, state.get("profile") or {})
                plan = state.get("plan", {})
                result = {"answer": state.get("answer", ""), "route": state.get("route", ""),
                          "sources": sources_payload(state.get("evidence_ordered") or []),
                          "verification": state.get("verification", {}), "timings": state.get("timings", {}),
                          "llm_calls": state.get("llm_calls", []),
                          "plan": {k: plan.get(k) for k in ("scope", "intents", "resolved_query", "needs_clarification")},
                          "entities": state.get("entities", {})}
                cacheable = (not history and plan.get("scope") == "in_scope" and not plan.get("needs_clarification")
                             and result["verification"].get("passed", False) and channel == "chat")
                if cacheable:
                    await asyncio.to_thread(answer_cache.put, qid, query, result["answer"], result["sources"])
        latency_ms = round((time.perf_counter() - t0) * 1000, 1)
        store.add_turn(session_id, "user", query)
        store.add_turn(session_id, "assistant", result["answer"])
        trace = [e for e in bus.trace if e.get("type") in ("agent", "tool", "llm", "retrieval")]
        llm_events = [e for e in trace if e["type"] == "llm"]
        synth = next((e for e in reversed(llm_events) if e.get("node") == "synthesizer" and not e.get("error")), {})
        retrieval_best = max((h["score"] for e in trace if e["type"] == "retrieval" for h in e.get("hits", [])), default=None)
        plan = result.get("plan") or {}
        metrics = {
            "latency_ms": latency_ms,
            "ttft_ms": bus.first_token_ms,            # request start → first streamed token
            "tpot_ms": synth.get("tpot_ms"),          # synthesizer time-per-output-token
            "tokens_per_s": synth.get("tokens_per_s"),
            "in_tokens": sum(e.get("in_tokens") or 0 for e in llm_events),
            "out_tokens": sum(e.get("out_tokens") or 0 for e in llm_events),
            "llm_ms": round(sum(e.get("ms") or 0 for e in llm_events), 1),
            "retrieval_ms": round(sum(e.get("ms") or 0 for e in trace if e["type"] == "retrieval"), 1),
            "retrieval_best": retrieval_best,
            "category": classify(query, result["route"], plan.get("intents"), plan.get("scope", "")),
            "confidence": confidence(result["route"], result.get("verification") or {}, result.get("sources") or [],
                                     retrieval_best, bool(plan.get("needs_clarification"))),
        }
        if llm_events:
            result["llm_calls"] = [{k: e.get(k) for k in ("node", "model", "ms", "ttft_ms", "tpot_ms", "in_tokens",
                                                          "out_tokens", "tokens_per_s", "attempt", "error")}
                                   for e in llm_events]
        telemetry.record({**entry, **{k: v for k, v in result.items() if k != "cache"}, **metrics, "trace": trace})
        emit({"type": "done", "question_id": qid, "answer": result["answer"], "cached": bool(entry.get("cached")),
              **metrics, **{k: v for k, v in result.items() if k not in ("answer",)}})
    except Exception as e:  # noqa: BLE001
        logger.exception("chat_pipeline_failed")
        telemetry.record({**entry, "error": str(e)[:300], "latency_ms": round((time.perf_counter() - t0) * 1000, 1)})
        emit({"type": "error", "question_id": qid, "message": "Xin lỗi, hệ thống gặp sự cố. Bạn thử lại giúp mình nhé."})


async def run_chat(query: str, session_id: str, channel: str = "chat") -> AsyncIterator[dict]:
    query = redact(sanitize_input(query))  # CCCD / phone / email never reach Gemini, Redis or logs
    channel = channel if channel in ("chat", "voice") else "chat"
    qid = f"q_{uuid.uuid4().hex[:12]}"
    bus = EventBus(question_id=qid)
    bus.emit({"type": "start", "query": query, "session_id": session_id, "channel": channel})
    ctx = bind(bus)
    try:
        task = asyncio.create_task(_pipeline(query, session_id, channel, qid, bus))
    finally:
        unbind(ctx)  # the task captured the context; the caller's context stays clean
    while True:
        ev = await bus.queue.get()
        yield ev
        if ev["type"] in ("done", "error"):
            break
    await task


async def ask(query: str, session_id: str, channel: str = "chat") -> dict:
    """Non-streaming helper (REST, evaluation)."""
    final: dict = {}
    async for ev in run_chat(query, session_id, channel):
        if ev["type"] in ("done", "error"):
            final = ev
    return final
