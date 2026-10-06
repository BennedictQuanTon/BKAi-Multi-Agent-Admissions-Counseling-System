"""Session-scoped student profile collected during counselling (no user database)."""

from __future__ import annotations

from pydantic import BaseModel, Field


class StudentProfile(BaseModel):
    composite_score: float | None = Field(None, description="Điểm xét tuyển tổng hợp dự kiến (thang 100)")
    dgnl: float | None = Field(None, description="Điểm ĐGNL đã nhân hệ số Toán (thang 1500)")
    thpt_math: float | None = None
    thpt_subject2: float | None = None
    thpt_subject3: float | None = None
    hocba_math: float | None = None
    hocba_subject2: float | None = None
    hocba_subject3: float | None = None
    priority_points_30: float | None = Field(None, description="Điểm ưu tiên khu vực + đối tượng (thang 30)")
    bonus_points: float | None = Field(None, description="Điểm cộng thành tích (≤10)")
    interests: list[str] = Field(default_factory=list, description="Ngành/lĩnh vực yêu thích")
    preferred_program: str | None = None
    budget_note: str | None = None

    def has_components(self) -> bool:
        return all(v is not None for v in (self.thpt_math, self.thpt_subject2, self.thpt_subject3,
                                           self.hocba_math, self.hocba_subject2, self.hocba_subject3))

    def summary_vi(self) -> str:
        parts = []
        if self.composite_score is not None:
            parts.append(f"điểm xét tuyển dự kiến ~{self.composite_score}")
        if self.dgnl is not None:
            parts.append(f"ĐGNL {self.dgnl}")
        if self.has_components():
            parts.append(f"THPT {self.thpt_math}/{self.thpt_subject2}/{self.thpt_subject3}, "
                         f"học bạ {self.hocba_math}/{self.hocba_subject2}/{self.hocba_subject3}")
        if self.interests:
            parts.append("quan tâm: " + ", ".join(self.interests))
        if self.preferred_program:
            parts.append(f"chương trình: {self.preferred_program}")
        if self.budget_note:
            parts.append(f"tài chính: {self.budget_note}")
        return "; ".join(parts) or "chưa có"

    def merge(self, patch: dict) -> "StudentProfile":
        data = self.model_dump()
        for k, v in (patch or {}).items():
            if k not in data or v in (None, "", []):
                continue
            data[k] = list(dict.fromkeys([*data[k], *v])) if k == "interests" else v
        return StudentProfile.model_validate(data)
