"""Question taxonomy (0 LLM) + an explainable per-answer confidence score — for observability."""

from __future__ import annotations

import re

from knowledge.text import normalize, strip_accents

CATEGORIES = {
    "diem_chuan": "Điểm chuẩn",
    "chi_tieu": "Chỉ tiêu",
    "hoc_phi": "Học phí & tài chính",
    "phuong_thuc": "Phương thức & công thức xét tuyển",
    "tieng_anh": "Chuẩn / quy đổi tiếng Anh",
    "tu_van": "Tư vấn chọn ngành / tính điểm",
    "nganh_hoc": "Ngành & chương trình",
    "nhap_hoc": "Nhập học & thủ tục",
    "doi_song": "Đời sống SV · KTX · học bổng",
    "ngoai_pham_vi": "Ngoài phạm vi",
    "chao_hoi": "Chào hỏi",
    "khac": "Khác",
}

_RULES: list[tuple[str, str]] = [
    ("tieng_anh", r"ielts|toefl|toeic|pte|quy doi|chuan (dau vao )?tieng anh|anh van"),
    ("hoc_phi", r"hoc phi|chi phi|tien hoc|mien giam|vay von|ck82"),
    ("chi_tieu", r"chi tieu"),
    ("diem_chuan", r"diem chuan|lay bao nhieu diem|bao nhieu diem|diem trung tuyen"),
    ("phuong_thuc", r"phuong thuc|cong thuc|xet tuyen|uu tien|diem cong|dgnl|danh gia nang luc|nguyen vong|to hop|tuyen thang"),
    ("nhap_hoc", r"nhap hoc|ho so|thu tuc|xac nhan|lich|han chot|tra cuu ket qua"),
    ("doi_song", r"ky tuc xa|\bktx\b|hoc bong|co so|thu vien|cau lac bo|doi song|trao doi"),
    ("nganh_hoc", r"nganh|chuyen nganh|chuong trinh|hoc gi|ra truong|lam gi|ma nganh"),
]


def classify(query: str, route: str = "", intents: list[str] | None = None, scope: str = "") -> str:
    if route == "guardrail" or scope in ("other_university", "off_topic"):
        return "ngoai_pham_vi"
    if scope == "smalltalk":
        return "chao_hoi"
    if "counsel" in (intents or []):
        return "tu_van"
    flat = strip_accents(normalize(query))
    for cat, pat in _RULES:
        if re.search(pat, flat):
            return cat
    return "khac"


def confidence(route: str, verification: dict, sources: list[dict], retrieval_best: float | None,
               needs_clarification: bool) -> float | None:
    """0–1. Grounding (structured fact/calc → 1.0, else best rerank score) × 0.6 + verifier pass × 0.4.

    Not applicable (None) for refusals, smalltalk and clarification questions.
    """
    if route == "cache":
        return 1.0
    if route == "guardrail" or needs_clarification or not sources:
        return None
    grounded = 1.0 if any(s.get("kind") in ("fact", "calc") for s in sources) else min(1.0, retrieval_best or 0.0)
    verified = 1.0 if verification.get("passed") else 0.0
    return round(0.6 * grounded + 0.4 * verified, 3)
