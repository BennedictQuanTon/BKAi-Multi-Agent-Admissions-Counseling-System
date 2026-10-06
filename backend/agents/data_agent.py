"""Admissions-Data agent — answers numeric questions exclusively from the typed facts DB (SQL tools)."""

from __future__ import annotations

import asyncio
import re
import time
from collections import defaultdict

from agents.state import Evidence, GraphState
from knowledge.facts import Entities, latest_year
from knowledge.text import normalize, strip_accents
from services.events import agent_event
from tools import admissions as T

SCORES_URL = "https://hcmut.edu.vn/tuyen-sinh/dai-hoc-chinh-quy/nganh-va-chi-tieu"
MAX_MAJORS = 8
METHOD_LABEL = {"TH": "Xét tuyển Tổng hợp", "UTXT": "Ưu tiên xét tuyển"}


def _vnd(v: int) -> str:
    return f"{v:,}".replace(",", ".") + " đồng"


def _majors_evidence(major_ids: list[str], years: list[int], methods: list[str], agent: str) -> list[Evidence]:
    scores = T.get_admission_scores(major_ids, None, methods or None, agent=agent)
    quotas = {q["major_code"] + q["program_id"]: q for q in T.get_quotas(major_ids, agent=agent)}
    profiles = {p["major_id"]: p for p in T.get_major_profiles(major_ids, agent=agent)}
    by_major: dict[str, list[dict]] = defaultdict(list)
    for s in scores:
        by_major[f"{s['program_id']}:{s['major_code']}"].append(s)

    out: list[Evidence] = []
    for mid in major_ids:
        p = profiles.get(mid)
        if not p:
            continue
        rows = by_major.get(mid, [])
        lines = [f"{p['name']} — mã {p['major_code']} — {p['program_name']}"]
        wanted = [r for r in rows if not years or r["year"] in years]
        if years and not wanted:
            have = sorted({r["year"] for r in rows})
            lines.append(f"Chưa có điểm chuẩn năm {', '.join(map(str, years))} cho mã này"
                         + (f"; các năm có dữ liệu: {', '.join(map(str, have))}." if have else "."))
            wanted = rows
        for r in sorted(wanted, key=lambda r: (-r["year"], r["method"])):
            lines.append(f"- Điểm chuẩn {r['year']} ({METHOD_LABEL[r['method']]}, thang 100): {r['score']:.2f}")
        if not rows:
            lines.append("- Chưa có điểm chuẩn các năm trước (ngành mới hoặc không công bố riêng).")
        q = quotas.get(p["major_code"] + p["program_id"])
        if q:
            scope = " (chỉ tiêu chung toàn chương trình)" if q["scope"] == "program_group" else ""
            lines.append(f"- Chỉ tiêu {q['year']}: {q['quota']}{scope}")
        if p.get("subject_combinations"):
            lines.append("- Tổ hợp: " + " | ".join(p["subject_combinations"]))
        if p.get("specializations"):
            lines.append("- Chuyên ngành: " + p["specializations"])
        if p.get("note"):
            lines.append("- Ghi chú: " + p["note"])
        out.append(Evidence(agent=agent, kind="fact", title=f"{p['name']} ({p['major_code']}) — dữ liệu chính thức",
                            content="\n".join(lines), source_url=SCORES_URL))
    return out


def _tuition_evidence(program_ids: list[str], agent: str) -> Evidence:
    rows = T.get_tuition(program_ids or None, agent=agent)
    groups: dict[str, list[str]] = defaultdict(list)
    for r in rows:
        groups[r["program_group"]].append(f"{r['academic_year']}: {_vnd(int(r['amount_vnd_per_year']))}/năm")
    content = "Học phí trung bình dự kiến (theo năm học):\n" + "\n".join(
        f"- Chương trình {g}: " + "; ".join(v) for g, v in groups.items())
    return Evidence(agent=agent, kind="fact", title="Học phí trung bình dự kiến 2024–2027", content=content,
                    source_url=rows[0]["source_url"] if rows else "")


def _english_evidence(agent: str) -> Evidence:
    rows = T.get_english_conversion(agent=agent)
    lines = ["Bảng quy đổi chứng chỉ tiếng Anh → điểm môn tiếng Anh (thi TN THPT):",
             "IELTS | PTE | TOEFL iBT | TOEFL iBT 2026 | TOEIC Nghe-Đọc | TOEIC Nói-Viết | Điểm môn tiếng Anh"]
    lines += [" | ".join(r[k] for k in ("ielts_academic", "pte_academic", "toefl_ibt", "toefl_ibt_2026",
                                         "toeic_listening_reading", "toeic_speaking_writing", "thpt_english_score"))
              for r in rows]
    return Evidence(agent=agent, kind="fact", title="Quy đổi chứng chỉ tiếng Anh 2026", content="\n".join(lines),
                    source_url=rows[0]["source_url"] if rows else "")


def _timeline_evidence(agent: str) -> Evidence:
    rows = T.get_timeline(agent=agent)
    content = "Các mốc thời gian tuyển sinh 2026:\n" + "\n".join(f"- {r['when']}: {r['event']}" for r in rows)
    return Evidence(agent=agent, kind="fact", title="Mốc thời gian tuyển sinh 2026", content=content,
                    source_url=rows[0]["source_url"] if rows else "")


def run_data_agent(query: str, ent: Entities, plan: dict) -> list[Evidence]:
    agent = "data"
    flat = strip_accents(normalize(query))
    evidence: list[Evidence] = []
    major_ids = list(ent.major_ids)
    if not major_ids:
        for hint in plan.get("major_hints", [])[:3]:
            major_ids += [m["major_id"] for m in T.find_majors(hint, ent.program_ids or None, agent=agent)]
        major_ids = list(dict.fromkeys(major_ids))
    if major_ids:
        if len(major_ids) > MAX_MAJORS:
            evidence.append(Evidence(agent=agent, kind="note", title="Ghi chú",
                                     content=f"Có {len(major_ids)} mã ngành khớp; chỉ liệt kê {MAX_MAJORS} mã đầu."))
            major_ids = major_ids[:MAX_MAJORS]
        evidence += _majors_evidence(major_ids, ent.years, ent.methods, agent)
    if re.search(r"hoc phi|chi phi|tien hoc|bao nhieu tien", flat):
        evidence.append(_tuition_evidence(ent.program_ids, agent))
    if re.search(r"ielts|toefl|toeic|pte|quy doi", flat):
        evidence.append(_english_evidence(agent))
    if re.search(r"khi nao|bao gio|han chot|lich|moc thoi gian|ngay nao|cong bo ket qua", flat):
        evidence.append(_timeline_evidence(agent))
    if not evidence and ent.years and max(ent.years) > latest_year():
        evidence.append(Evidence(agent=agent, kind="note", title="Ghi chú",
                                 content=f"Dữ liệu mới nhất là mùa tuyển sinh {latest_year()}; năm {max(ent.years)} chưa công bố."))
    return evidence


async def data_agent_node(state: GraphState) -> dict:
    t0 = time.perf_counter()
    agent_event("data", "running", "Truy vấn cơ sở dữ liệu tuyển sinh có cấu trúc")
    plan = state["plan"]
    ent = Entities(**state["entities"])
    evidence = await asyncio.to_thread(run_data_agent, plan["resolved_query"], ent, plan)
    agent_event("data", "done", f"{len(evidence)} nhóm dữ liệu")
    return {"evidence": evidence, "timings": {"data_ms": round((time.perf_counter() - t0) * 1000, 1)}}
