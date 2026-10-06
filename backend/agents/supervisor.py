"""
Supervisor agent — plans the work. Adaptive routing: clear, single-turn fact/policy questions take a
deterministic fast path (0 LLM calls); multi-turn, counselling or ambiguous questions get an LLM plan.
"""

from __future__ import annotations

import re
import time

from langchain_core.messages import HumanMessage, SystemMessage

from agents.state import GraphState, Plan
from config.prompts import SUPERVISOR_PROMPT
from knowledge.facts import resolve
from knowledge.text import normalize, strip_accents
from memory.student_profile import StudentProfile
from services import llm
from services.events import agent_event

FACT_SIGNALS = r"diem chuan|chi tieu|to hop|hoc phi|ma nganh|quy doi|ielts|toefl|toeic|lay bao nhieu diem|bao nhieu diem"
COUNSEL_SIGNALS = (r"nen (chon|hoc|dang ky|vao)|tu van|phu hop|co (dau|do|trung tuyen)|kha nang|"
                   r"minh (duoc|co|dat|thi)|em (duoc|co|dat|thi)|tinh diem|so sanh .* nganh|nganh nao")
SMALLTALK = r"^(xin chao|chao( ban| ad| admin)?|hello|hi|cam on|thank|ok|oke|vang|da)[\s!.?]*$"


def _history_text(history: list[dict], limit: int = 6) -> str:
    lines = [f"{'Thí sinh' if t['role'] == 'user' else 'BKAi'}: {t['content'][:400]}" for t in history[-limit:]]
    return "\n".join(lines) or "(không có)"


def fast_path(query: str, history: list[dict], guard: str = "allow") -> Plan | None:
    """Deterministic plan when the question is self-contained, unambiguous AND clearly in scope.

    Inputs the rule guard could not place (guard="uncertain") always go to the LLM supervisor,
    which owns the final scope decision.
    """
    flat = strip_accents(normalize(query))
    if re.match(SMALLTALK, flat):
        return Plan(scope="smalltalk", intents=[], resolved_query=query)
    if guard != "allow" or history or re.search(COUNSEL_SIGNALS, flat):
        return None
    ent = resolve(query)
    intents: list = []
    if re.search(FACT_SIGNALS, flat):
        intents.append("facts")
    if not ent.major_ids or not intents:
        intents.append("policy")
    return Plan(scope="in_scope", intents=intents, resolved_query=query, search_queries=[query], years=ent.years)


async def supervisor_node(state: GraphState) -> dict:
    t0 = time.perf_counter()
    query, history = state["query"], state.get("history", [])
    plan = fast_path(query, history, state.get("guard", "allow"))
    route = "fast_path"
    calls: list[dict] = []
    if plan is None:
        route = "supervisor"
        agent_event("supervisor", "running", "Lập kế hoạch: phạm vi, ý định, ngữ cảnh hội thoại")
        meta: dict = {}
        try:
            plan = await llm.structured(Plan, [
                SystemMessage(content=SUPERVISOR_PROMPT),
                HumanMessage(content=f"## Hồ sơ thí sinh\n{state.get('profile_summary', 'chưa có')}\n\n"
                                     f"## Lịch sử\n{_history_text(history)}\n\n## Câu hỏi mới\n{query}"),
            ], meta=meta, node="supervisor")
        except Exception as e:  # noqa: BLE001 — degrade to a safe default plan
            plan = Plan(scope="in_scope", intents=["facts", "policy"], resolved_query=query, search_queries=[query])
            meta["error"] = str(e)[:200]
        calls.append({"node": "supervisor", "ms": round((time.perf_counter() - t0) * 1000), **meta})
    plan.resolved_query = plan.resolved_query or query

    ent = resolve(" ".join([plan.resolved_query, *plan.major_hints, plan.program_hint or ""]))
    if plan.years:
        ent.years = sorted(set(ent.years) | set(plan.years))
    if plan.scope == "in_scope" and not plan.intents:
        plan.intents = ["policy"]
    profile = StudentProfile.model_validate(state.get("profile") or {})
    patch = plan.profile_patch.model_dump(exclude_none=True)
    if ent.mentioned_scores and "counsel" in plan.intents and profile.composite_score is None:
        patch.setdefault("composite_score", ent.mentioned_scores[0])
    profile = profile.merge(patch)
    agent_event("supervisor", "done", f"route={route} · scope={plan.scope} · intents={','.join(plan.intents) or '-'}",
                route=route, plan=plan.model_dump(), entities=ent.to_dict())
    return {"plan": plan.model_dump(), "entities": ent.to_dict(), "route": route, "llm_calls": calls,
            "profile": profile.model_dump(), "profile_summary": profile.summary_vi(),
            "timings": {"supervisor_ms": round((time.perf_counter() - t0) * 1000, 1)}}
