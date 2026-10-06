"""
Admissions tool registry — the single source of truth for every capability an agent can call.

The same functions are (1) invoked in-process by the LangGraph agents and (2) exported over the
Model Context Protocol by ``mcp_server.py`` so any MCP client (Claude Desktop, Cursor, Open WebUI via
mcpo, …) can use BKAi's admissions data.
"""

from __future__ import annotations

import time
from typing import Any

from knowledge import facts
from knowledge.text import normalize, strip_accents
from retrieval.search import search
from services.events import emit, tool_event

_PREVIEW_KEYS = ("major_code", "major_name", "name", "program_id", "year", "method", "score", "quota", "scope",
                 "academic_year", "program_group", "amount_vnd_per_year", "cutoff", "delta", "band", "diem_xet_tuyen",
                 "when", "event", "ielts_academic", "thpt_english_score")


def _preview(out) -> list[dict]:
    rows = out if isinstance(out, list) else out.get("results", [out]) if isinstance(out, dict) else []
    return [{k: r[k] for k in _PREVIEW_KEYS if isinstance(r, dict) and k in r} for r in rows[:6]]


def _timed(agent: str, name: str, args: dict, fn, *a, **kw):
    t = time.perf_counter()
    out = fn(*a, **kw)
    n = len(out) if isinstance(out, list) else len(out.get("results", [])) if isinstance(out, dict) else 1
    tool_event(agent, name, args, f"{n} result(s)", (time.perf_counter() - t) * 1000, preview=_preview(out))
    return out


def find_majors(keyword: str, program_ids: list[str] | None = None, agent: str = "data") -> list[dict]:
    """Accent-insensitive search of majors by name/specialisation (used when the resolver finds nothing)."""
    def run():
        kw = strip_accents(normalize(keyword))
        rows = facts.list_majors(program_ids)
        profiles = {m["major_id"]: m for m in facts.get_major_profiles([r["major_id"] for r in rows])}
        return [r for r in rows
                if kw and (kw in strip_accents(normalize(r["name"]))
                           or kw in strip_accents(normalize(profiles[r["major_id"]].get("specializations") or "")))]
    return _timed(agent, "find_majors", {"keyword": keyword, "program_ids": program_ids}, run)


def get_admission_scores(major_ids: list[str], years: list[int] | None = None, methods: list[str] | None = None,
                         agent: str = "data") -> list[dict]:
    """Official cut-off scores (điểm chuẩn) by major / year / method (TH = Xét tuyển Tổng hợp, UTXT)."""
    return _timed(agent, "get_admission_scores", {"major_ids": major_ids, "years": years, "methods": methods},
                  facts.get_admission_scores, major_ids, years, methods)


def get_quotas(major_ids: list[str], agent: str = "data") -> list[dict]:
    """2026 admission quotas (chỉ tiêu). scope=program_group means one quota shared by the whole program."""
    return _timed(agent, "get_quotas", {"major_ids": major_ids}, facts.get_quotas, major_ids)


def get_major_profiles(major_ids: list[str], agent: str = "data") -> list[dict]:
    """Name, specialisations, subject combinations, partner universities of majors."""
    return _timed(agent, "get_major_profiles", {"major_ids": major_ids}, facts.get_major_profiles, major_ids)


def get_tuition(program_ids: list[str] | None = None, agent: str = "data") -> list[dict]:
    """Average expected tuition (VND / year) per program group, academic years 2024-25 → 2026-27."""
    return _timed(agent, "get_tuition", {"program_ids": program_ids}, facts.get_tuition, program_ids)


def get_english_conversion(agent: str = "data") -> list[dict]:
    """IELTS / TOEFL / TOEIC / PTE → THPT English score conversion table."""
    return _timed(agent, "get_english_conversion", {}, facts.get_english_conversion)


def get_timeline(agent: str = "data") -> list[dict]:
    """Key admission dates of the 2026 season."""
    return _timed(agent, "get_timeline", {}, facts.get_timeline)


def search_documents(query: str, program_ids: list[str] | None = None, top_k: int = 5,
                     agent: str = "policy") -> list[dict]:
    """Hybrid (dense + BM25) search with Vietnamese cross-encoder reranking over official documents."""
    t = time.perf_counter()
    timings: dict[str, Any] = {}
    hits = search(query, top_k=top_k, program_ids=program_ids, timings=timings)
    ms = (time.perf_counter() - t) * 1000
    tool_event(agent, "search_documents", {"query": query, **({"program_ids": program_ids} if program_ids else {})},
               f"{len(hits)} chunk(s), top={hits[0].score:.2f}" if hits else "0 chunk(s)", ms)
    emit({"type": "retrieval", "agent": agent, "query": query, "ms": round(ms, 1), "timings": timings,
          "hits": [{"rank": i + 1, "doc_id": h.doc_id, "title": h.title, "section": h.section[:120],
                    "score": round(h.score, 4), "fused_rank": h.rank_fused, "source_type": h.source_type,
                    "chars": len(h.text), "preview": h.text[:180].replace("\n", " ")} for i, h in enumerate(hits)]})
    return [{**h.to_dict(), "parent_text": h.parent_text} for h in hits]


def compute_admission_score(thpt_math: float, thpt_subject2: float, thpt_subject3: float, hocba_math: float,
                            hocba_subject2: float, hocba_subject3: float, dgnl: float | None = None,
                            bonus_points: float = 0.0, priority_points_30: float = 0.0,
                            agent: str = "counsel") -> dict:
    """Composite admission score 2026 (official formula, scale 100)."""
    args = dict(thpt_math=thpt_math, thpt_subject2=thpt_subject2, thpt_subject3=thpt_subject3, hocba_math=hocba_math,
                hocba_subject2=hocba_subject2, hocba_subject3=hocba_subject3, dgnl=dgnl, bonus_points=bonus_points,
                priority_points_30=priority_points_30)
    return _timed(agent, "compute_admission_score", args, facts.compute_admission_score, **args)


def recommend_majors(score: float, major_ids: list[str] | None = None, program_ids: list[str] | None = None,
                     limit: int = 8, agent: str = "counsel") -> dict:
    """Compare a composite score with the latest cut-offs → an toàn / vừa sức / thử thách bands."""
    return _timed(agent, "recommend_majors", {"score": score, "major_ids": major_ids, "program_ids": program_ids},
                  facts.recommend_majors, score, major_ids, program_ids, limit)


def list_majors(program_ids: list[str] | None = None, agent: str = "data") -> list[dict]:
    """All admission codes, optionally filtered by program."""
    return _timed(agent, "list_majors", {"program_ids": program_ids}, facts.list_majors, program_ids)


MCP_TOOLS = [find_majors, get_admission_scores, get_quotas, get_major_profiles, get_tuition, get_english_conversion,
             get_timeline, search_documents, compute_admission_score, recommend_majors, list_majors]
