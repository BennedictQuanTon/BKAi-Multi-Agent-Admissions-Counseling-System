"""
BKAi multi-agent graph (LangGraph).

    guard → supervisor ─┬─► data agent ────┐
                        ├─► policy agent ──┼─► synthesizer ─► verifier ─► END
                        ├─► counsel agent ─┘
                        └─► refuse ─► END

Specialists run in parallel (fan-out) and their evidence is merged by a list reducer (fan-in).
"""

from __future__ import annotations

from functools import lru_cache

from langgraph.graph import END, START, StateGraph

from agents.counsel_agent import counsel_agent_node
from agents.data_agent import data_agent_node
from agents.policy_agent import policy_agent_node
from agents.state import GraphState
from agents.supervisor import supervisor_node
from agents.synthesizer import synthesizer_node
from agents.verifier import verifier_node
from config.prompts import REFUSAL_OFF_TOPIC, REFUSAL_OTHER_UNI
from memory.student_profile import StudentProfile
from services.events import agent_event, token


async def refuse_node(state: GraphState) -> dict:
    text = REFUSAL_OTHER_UNI if state["plan"]["scope"] == "other_university" else REFUSAL_OFF_TOPIC
    agent_event("guard", "done", f"Từ chối: {state['plan']['scope']}")
    token(text)
    return {"answer": text, "verification": {"checked": False, "passed": True, "unsupported": []}}


def route_after_supervisor(state: GraphState) -> list[str]:
    plan = state["plan"]
    if plan["scope"] in ("other_university", "off_topic"):
        return ["refuse"]
    if plan["scope"] == "smalltalk":
        return ["synthesizer"]
    intents = set(plan.get("intents") or [])
    targets = []
    if "facts" in intents:
        targets.append("data")
    if "policy" in intents:
        targets.append("policy")
    if "counsel" in intents:
        prof = StudentProfile.model_validate(state.get("profile") or {})
        has_score = prof.composite_score is not None or prof.has_components() or state["entities"].get("mentioned_scores")
        if has_score:
            targets.append("counsel")
        elif not targets:
            targets.append("data" if state["entities"].get("major_ids") else "policy")
    return targets or ["policy"]


@lru_cache(maxsize=1)
def get_graph():
    g = StateGraph(GraphState)
    g.add_node("supervisor", supervisor_node)
    g.add_node("data", data_agent_node)
    g.add_node("policy", policy_agent_node)
    g.add_node("counsel", counsel_agent_node)
    g.add_node("synthesizer", synthesizer_node)
    g.add_node("verifier", verifier_node)
    g.add_node("refuse", refuse_node)
    g.add_edge(START, "supervisor")
    g.add_conditional_edges("supervisor", route_after_supervisor,
                            ["data", "policy", "counsel", "synthesizer", "refuse"])
    for node in ("data", "policy", "counsel"):
        g.add_edge(node, "synthesizer")
    g.add_edge("synthesizer", "verifier")
    g.add_edge("verifier", END)
    g.add_edge("refuse", END)
    return g.compile()
