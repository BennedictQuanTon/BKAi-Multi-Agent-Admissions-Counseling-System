"""
Verifier — deterministic numeric grounding check (no LLM on the happy path).

Every score / quota / money amount in the answer must appear in the evidence (after normalising
Vietnamese number formats). On failure the answer is rewritten once with the offending numbers named,
and a `replace` event swaps the streamed text in the UI.
"""

from __future__ import annotations

import re
import time

from agents.state import GraphState
from agents.synthesizer import build_messages, order_evidence
from config.prompts import REPAIR
from services import llm
from services.events import agent_event, emit

_NUM = re.compile(r"(?<![\w/])(\d{1,3}(?:[.,]\d{3})+|\d+(?:[.,]\d+)?)(\s*(?:triệu|tr\b|nghìn|ngàn|%))?", re.I)
_PHONE_URL = re.compile(r"\(?0\d{2}\)?[\s.]?\d{3,4}[\s.]?\d{3,4}|https?://\S+|\S+@\S+|\[\d+\]")
_DATE = re.compile(r"\b\d{1,2}/\d{1,2}(?:/\d{2,4})?\b|\b\d{1,2}g\d{0,2}\b")


def _values(text: str) -> set[float]:
    """All numeric values in `text`, normalised; money gets scale variants (31.500.000 ≡ 31,5 triệu ≡ 31,500)."""
    text = _DATE.sub(" ", _PHONE_URL.sub(" ", text))
    out: set[float] = set()
    for raw, unit in _NUM.findall(text):
        s = raw
        if re.fullmatch(r"\d{1,3}(?:[.,]\d{3})+", s):        # thousands separators
            v = float(re.sub(r"[.,]", "", s))
            if re.fullmatch(r"\d{1,3}[.,]\d{3}", s):          # ambiguous: 31,500 or 85.410?
                out.add(float(s.replace(",", ".")))
        else:
            v = float(s.replace(",", "."))
        unit = (unit or "").strip().lower()
        if unit in ("triệu", "tr"):
            v *= 1_000_000
        elif unit in ("nghìn", "ngàn"):
            v *= 1_000
        out.add(round(v, 2))
        if v >= 1_000:      # 31.500.000 ≡ 31,500 (nghìn đồng) ≡ 31,5 (triệu)
            out.update({round(v / 1_000, 2), round(v / 1_000_000, 2)})
        if v < 1_000_000:
            out.update({round(v * 1_000, 2), round(v * 1_000_000, 2)})
    return out


def unsupported_numbers(answer: str, evidence_text: str) -> list[str]:
    ev = _values(evidence_text)
    clean = _DATE.sub(" ", _PHONE_URL.sub(" ", answer))
    bad = []
    for raw, unit in _NUM.findall(clean):
        token = (raw + (unit or "")).strip()
        vals = _values(token)
        base = float(re.sub(r"[.,](?=\d{3}\b)", "", raw).replace(",", "."))
        if not unit and (base < 32 or 2000 <= base <= 2035):   # small counts, days, years → not checked
            continue
        if not vals & ev:
            bad.append(token)
    return list(dict.fromkeys(bad))


async def verifier_node(state: GraphState) -> dict:
    t0 = time.perf_counter()
    answer = state.get("answer", "")
    evidence = state.get("evidence_ordered") or order_evidence(state.get("evidence", []))
    ev_text = "\n".join(e.get("content", "") for e in evidence)
    bad = unsupported_numbers(answer, ev_text) if evidence else []
    result = {"checked": True, "unsupported": bad, "repaired": False, "passed": not bad}
    calls = []
    if bad:
        agent_event("verifier", "running", f"Phát hiện số không có trong evidence: {', '.join(bad)} → viết lại")
        meta: dict = {}
        try:
            fixed = (await llm.complete(build_messages(state, evidence, REPAIR.format(bad=", ".join(bad))), meta=meta, node="verifier_repair")).strip()
            still = unsupported_numbers(fixed, ev_text)
            if fixed and len(still) < len(bad):
                answer = fixed
                result.update(repaired=True, unsupported_after=still, passed=not still)
                emit({"type": "replace", "answer": answer})
        except Exception as e:  # noqa: BLE001
            meta["error"] = str(e)[:200]
        calls.append({"node": "verifier_repair", "ms": round((time.perf_counter() - t0) * 1000), **meta})
    agent_event("verifier", "done", "✓ mọi con số khớp evidence" if result["passed"] else "⚠ còn số chưa xác minh",
                **{k: v for k, v in result.items() if k != "checked"})
    return {"answer": answer, "verification": result, "llm_calls": calls,
            "timings": {"verifier_ms": round((time.perf_counter() - t0) * 1000, 1)}}
