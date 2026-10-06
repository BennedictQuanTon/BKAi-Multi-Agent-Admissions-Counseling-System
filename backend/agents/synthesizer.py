"""Synthesizer — streams the final answer grounded on agent evidence, with [n] citations."""

from __future__ import annotations

import time

from langchain_core.messages import HumanMessage, SystemMessage

from agents.state import Evidence, GraphState
from config import prompts as P
from services import llm
from services.events import agent_event, emit, token

KIND_ORDER = {"fact": 0, "calc": 1, "doc": 2, "note": 3}
MAX_EVIDENCE_CHARS = 7000


def order_evidence(evidence: list[Evidence]) -> list[Evidence]:
    return sorted(evidence, key=lambda e: (KIND_ORDER.get(e.get("kind", "doc"), 9), -e.get("score", 0)))


def evidence_block(evidence: list[Evidence]) -> str:
    parts, total = [], 0
    for i, e in enumerate(evidence, 1):
        block = f"[{i}] {e.get('title', '')}\n{e.get('content', '')}"
        if total + len(block) > MAX_EVIDENCE_CHARS:
            block = block[: max(0, MAX_EVIDENCE_CHARS - total)]
        parts.append(block)
        total += len(block)
        if total >= MAX_EVIDENCE_CHARS:
            break
    return "\n\n".join(parts) or "(không có evidence)"


def sources_payload(evidence: list[Evidence]) -> list[dict]:
    return [{"id": i, "title": e.get("title", ""), "url": e.get("source_url", ""), "agent": e.get("agent", ""),
             "kind": e.get("kind", "")} for i, e in enumerate(evidence, 1)]


def build_messages(state: GraphState, evidence: list[Evidence], extra: str = "") -> list:
    plan = state["plan"]
    channel = P.SYNTH_VOICE if state.get("channel") == "voice" else P.SYNTH_CHAT
    if plan["scope"] == "smalltalk":
        mode = P.SMALLTALK
    elif plan.get("needs_clarification") and not evidence:
        mode = P.CLARIFY + (f"\nGợi ý câu hỏi: {plan['clarify_question']}" if plan.get("clarify_question") else "")
    else:
        mode = ""
    history = "\n".join(f"{'Thí sinh' if t['role'] == 'user' else 'BKAi'}: {t['content'][:300]}"
                        for t in state.get("history", [])[-4:]) or "(không có)"
    system = "\n\n".join(x for x in (P.SYNTH_PERSONA, P.SYNTH_RULES, channel, mode, extra) if x)
    human = (f"## Hồ sơ thí sinh\n{state.get('profile_summary', 'chưa có')}\n\n## Lịch sử gần đây\n{history}\n\n"
             f"## EVIDENCE\n{evidence_block(evidence)}\n\n## Câu hỏi\n{plan['resolved_query']}")
    return [SystemMessage(content=system), HumanMessage(content=human)]


async def synthesizer_node(state: GraphState) -> dict:
    t0 = time.perf_counter()
    evidence = order_evidence(state.get("evidence", []))
    emit({"type": "sources", "sources": sources_payload(evidence)})
    agent_event("synthesizer", "running", f"Tổng hợp câu trả lời từ {len(evidence)} evidence")
    meta: dict = {}
    chunks: list[str] = []
    ttft = None
    try:
        async for piece in llm.stream(build_messages(state, evidence), meta=meta, node="synthesizer"):
            if ttft is None:
                ttft = time.perf_counter() - t0
            chunks.append(piece)
            token(piece)
        answer = "".join(chunks).strip()
    except Exception as e:  # noqa: BLE001
        meta["error"] = str(e)[:200]
        answer = ("Xin lỗi, hệ thống đang quá tải nên mình chưa trả lời được ngay. Bạn thử lại sau ít phút, "
                  "hoặc liên hệ tuyensinh@hcmut.edu.vn · (028) 2214 6888 nhé.")
        token(answer)
    ms = round((time.perf_counter() - t0) * 1000, 1)
    agent_event("synthesizer", "done", f"{len(answer)} ký tự", model=meta.get("model"))
    return {"answer": answer, "evidence_ordered": evidence,
            "llm_calls": [{"node": "synthesizer", "ms": ms, "ttft_ms": round((ttft or 0) * 1000, 1), **meta}],
            "timings": {"synthesizer_ms": ms, "synth_ttft_ms": round((ttft or 0) * 1000, 1)}}
