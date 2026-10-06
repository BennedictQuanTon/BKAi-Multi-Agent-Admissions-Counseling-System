"""Counsel agent — deterministic score calculator + cut-off comparison (an toàn / vừa sức / thử thách)."""

from __future__ import annotations

import asyncio
import time

from agents.state import Evidence, GraphState
from knowledge.facts import Entities
from memory.student_profile import StudentProfile
from services.events import agent_event
from tools import admissions as T

BAND_VI = {"an_toan": "An toàn", "vua_suc": "Vừa sức", "thu_thach": "Thử thách", "kho": "Khó"}
FORMULA_URL = "https://hcmut.edu.vn/tuyen-sinh/dai-hoc-chinh-quy/phuong-thuc-tuyen-sinh/xet-tuyen-tong-hop-2026"


def run_counsel_agent(profile: StudentProfile, ent: Entities) -> list[Evidence]:
    agent = "counsel"
    out: list[Evidence] = []
    score = profile.composite_score or (ent.mentioned_scores[0] if ent.mentioned_scores else None)
    if profile.has_components():
        calc = T.compute_admission_score(profile.thpt_math, profile.thpt_subject2, profile.thpt_subject3,
                                         profile.hocba_math, profile.hocba_subject2, profile.hocba_subject3,
                                         profile.dgnl, profile.bonus_points or 0.0, profile.priority_points_30 or 0.0,
                                         agent=agent)
        score = calc["diem_xet_tuyen"]
        out.append(Evidence(agent=agent, kind="calc", title="Tính điểm xét tuyển tổng hợp 2026 (công cụ)",
                            content=(f"Đối tượng {calc['doi_tuong']}: điểm năng lực {calc['diem_nang_luc']}, "
                                     f"TNTHPT quy đổi {calc['diem_tnthpt_quy_doi']}, học THPT quy đổi "
                                     f"{calc['diem_hoc_thpt_quy_doi']} → điểm học lực {calc['diem_hoc_luc']}; "
                                     f"điểm cộng {calc['diem_cong']}; điểm ưu tiên {calc['diem_uu_tien']} → "
                                     f"ĐIỂM XÉT TUYỂN {calc['diem_xet_tuyen']}/100.\n{calc['cong_thuc']}"),
                            source_url=FORMULA_URL))
    if score is None:
        return out
    rec = T.recommend_majors(score, ent.major_ids or None, ent.program_ids or None, limit=8, agent=agent)
    if not rec["results"] and ent.major_ids:  # interests outside the requested program → widen
        rec = T.recommend_majors(score, ent.major_ids, None, limit=8, agent=agent)
    lines = [f"So sánh điểm {score} với điểm chuẩn Xét tuyển Tổng hợp {rec['reference_year']}:"]
    for r in rec["results"]:
        trend = "" if r["trend"] is None else f", so với năm trước {r['trend']:+.2f}"
        lines.append(f"- {r['major_name']} (mã {r['major_code']}, {r['program_name']}): điểm chuẩn "
                     f"{r['cutoff']:.2f}{trend} → chênh {r['delta']:+.2f} → {BAND_VI[r['band']]}")
    lines.append(rec["disclaimer"])
    out.append(Evidence(agent=agent, kind="calc", title="Đối chiếu điểm chuẩn (công cụ recommend_majors)",
                        content="\n".join(lines), source_url="https://hcmut.edu.vn/tuyen-sinh/dai-hoc-chinh-quy/nganh-va-chi-tieu"))
    return out


async def counsel_agent_node(state: GraphState) -> dict:
    t0 = time.perf_counter()
    agent_event("counsel", "running", "Tính điểm & đối chiếu điểm chuẩn theo hồ sơ thí sinh")
    profile = StudentProfile.model_validate(state.get("profile") or {})
    ent = Entities(**state["entities"])
    evidence = await asyncio.to_thread(run_counsel_agent, profile, ent)
    agent_event("counsel", "done", f"{len(evidence)} kết quả công cụ")
    return {"evidence": evidence, "timings": {"counsel_ms": round((time.perf_counter() - t0) * 1000, 1)}}
