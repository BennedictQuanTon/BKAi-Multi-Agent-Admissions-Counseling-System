"""Request / response models."""

from __future__ import annotations

from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=500)
    session_id: str = Field(default="default", max_length=64)
    channel: str = Field(default="chat", pattern="^(chat|voice)$")


class ChatResponse(BaseModel):
    question_id: str = ""
    answer: str
    route: str = ""
    cached: bool = False
    latency_ms: float = 0.0
    ttft_ms: float | None = None
    sources: list[dict] = []
    verification: dict = {}
    timings: dict = {}
    llm_calls: list[dict] = []
    plan: dict = {}


class SessionRequest(BaseModel):
    session_id: str = Field(..., min_length=1, max_length=64)


class FeedbackRequest(BaseModel):
    question_id: str = Field(..., min_length=1, max_length=64)
    feedback: str = Field(..., pattern="^(like|dislike)$")


class AdminReviewRequest(BaseModel):
    question_id: str = Field(..., min_length=1, max_length=64)
    verdict: str = Field(..., pattern="^(correct|incorrect)$")


class AdminDeleteRequest(BaseModel):
    question_id: str = Field(..., min_length=1, max_length=64)


class CalcRequest(BaseModel):
    thpt_math: float = Field(..., ge=0, le=10)
    thpt_subject2: float = Field(..., ge=0, le=10)
    thpt_subject3: float = Field(..., ge=0, le=10)
    hocba_math: float = Field(..., ge=0, le=10)
    hocba_subject2: float = Field(..., ge=0, le=10)
    hocba_subject3: float = Field(..., ge=0, le=10)
    dgnl: float | None = Field(None, ge=0, le=1500)
    bonus_points: float = Field(0.0, ge=0, le=10)
    priority_points_30: float = Field(0.0, ge=0, le=2.75)
    program_ids: list[str] = []
    interests: list[str] = []


class TTSRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=2000)
