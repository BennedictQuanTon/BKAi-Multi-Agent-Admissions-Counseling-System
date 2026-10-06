"""Shared LangGraph state for the BKAi multi-agent graph."""

from __future__ import annotations

import operator
from typing import Annotated, Literal, TypedDict

from pydantic import BaseModel, Field

Scope = Literal["in_scope", "other_university", "off_topic", "smalltalk"]
Intent = Literal["facts", "policy", "counsel"]


class ProfilePatch(BaseModel):
    composite_score: float | None = Field(None, description="Điểm xét tuyển tổng hợp (thang 100) nếu thí sinh nêu")
    dgnl: float | None = Field(None, description="Điểm ĐGNL (thang 1500, đã nhân hệ số Toán)")
    thpt_math: float | None = None
    thpt_subject2: float | None = None
    thpt_subject3: float | None = None
    hocba_math: float | None = None
    hocba_subject2: float | None = None
    hocba_subject3: float | None = None
    priority_points_30: float | None = None
    bonus_points: float | None = None
    interests: list[str] = Field(default_factory=list)
    preferred_program: str | None = None
    budget_note: str | None = None


class Plan(BaseModel):
    scope: Scope = "in_scope"
    intents: list[Intent] = Field(default_factory=list)
    resolved_query: str = ""
    search_queries: list[str] = Field(default_factory=list, max_length=2)
    major_hints: list[str] = Field(default_factory=list)
    program_hint: str | None = None
    years: list[int] = Field(default_factory=list)
    profile_patch: ProfilePatch = Field(default_factory=ProfilePatch)
    needs_clarification: bool = False
    clarify_question: str = ""


class Evidence(TypedDict, total=False):
    agent: str          # data | policy | counsel
    kind: str           # fact | doc | calc | note
    title: str
    content: str        # compact text shown to the synthesizer
    source_url: str
    numbers: list[str]  # raw numeric strings for the verifier
    score: float


class GraphState(TypedDict, total=False):
    query: str
    session_id: str
    channel: str
    guard: str                       # allow | uncertain (rule guardrail verdict)
    history: list[dict]
    profile: dict
    profile_summary: str
    plan: dict
    route: str                       # fast_path | supervisor
    entities: dict
    evidence: Annotated[list[Evidence], operator.add]
    evidence_ordered: list[Evidence]
    answer: str
    verification: dict
    llm_calls: Annotated[list[dict], operator.add]
    timings: Annotated[dict, operator.or_]
