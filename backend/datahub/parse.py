"""
Parse a crawl snapshot (+ the v4 legacy KB) into curated, human-reviewable data:

  curated/structured/*.csv   long-format fact tables (one fact per row, with provenance)
  curated/documents/**.md    markdown documents with YAML front-matter for RAG
"""

from __future__ import annotations

import csv
import json
import re
import unicodedata
from dataclasses import dataclass, field
from pathlib import Path

from bs4 import BeautifulSoup
from markdownify import markdownify

from config.settings import DOCUMENTS_DIR, LEGACY_DIR, STRUCTURED_DIR
from datahub.crawl import latest_snapshot
from datahub.html_table import expand_table
from datahub.sources import SOURCE_BY_SLUG, SOURCES
from utils.logger import get_logger

logger = get_logger(__name__)

# ──────────────────────────────────────────────
# Programs (hệ đào tạo) — official names, 2026
# ──────────────────────────────────────────────
PROGRAMS = [
    # program_id, name, code_prefix, language, header keyword in the official table
    ("tieu_chuan", "Chương trình Tiêu chuẩn", "1xx", "Tiếng Việt", "CHƯƠNG TRÌNH TIÊU CHUẨN"),
    ("tien_tien", "Chương trình Tiên tiến", "208", "Tiếng Anh", "CHƯƠNG TRÌNH TIÊN TIẾN"),
    ("tieng_anh", "Chương trình Dạy và học bằng tiếng Anh", "2xx", "Tiếng Anh", "DẠY VÀ HỌC BẰNG TIẾNG ANH"),
    ("dinh_huong_nhat", "Chương trình Định hướng Nhật Bản", "26x", "Tiếng Việt + tiếng Nhật", "ĐỊNH HƯỚNG NHẬT BẢN"),
    ("chuyen_tiep_quoc_te", "Chương trình Chuyển tiếp Quốc tế (Úc, Mỹ, New Zealand, Châu Âu)", "3xx", "Tiếng Anh", "CHUYỂN TIẾP QUỐC TẾ"),
    ("chuyen_tiep_nhat_ban", "Chương trình Chuyển tiếp Quốc tế (Nhật Bản)", "108", "Tiếng Việt + tiếng Nhật", None),
    ("lien_ket_tne", "Chương trình Liên kết Cử nhân Kỹ thuật Quốc tế (ĐH Công nghệ Sydney - UTS cấp bằng)", "4xx", "Tiếng Anh", "LIÊN KẾT CỬ NHÂN"),
    ("tai_nang", "Chương trình Tài năng", None, "Tiếng Việt", None),
    ("pfiev", "Chương trình Kỹ sư Chất lượng cao Việt - Pháp (PFIEV)", None, "Tiếng Việt + tiếng Pháp", None),
]
PROGRAM_NAME = {p[0]: p[1] for p in PROGRAMS}

# Image-only content on official pages, transcribed by hand and verified against the image.
IMAGE_TRANSCRIPTIONS = {
    "uM3GCBF4C9P2_-dgJOF65b4W.png": "[Điểm Xét tuyển] = [Điểm học lực] + [Điểm cộng] + [Điểm ưu tiên]",
    "fwwWl_GB6y_V1e5MBsZjOcfA.png": (
        "[Điểm học lực] = [Điểm năng lực] × 70% + [Điểm TNTHPT quy đổi] × 20% "
        "+ [Điểm học THPT quy đổi] × 10%"
    ),
}

# Common ways students refer to majors / programs → canonical targets.
MANUAL_ALIASES = [
    # alias, kind, target
    ("khmt", "major", "Khoa học Máy tính"),
    ("computer science", "major", "Khoa học Máy tính"), ("ktmt", "major", "Kỹ thuật Máy tính"),
    ("computer engineering", "major", "Kỹ thuật Máy tính"), ("cntt", "major", "Công nghệ Thông tin"),
    ("ttnt", "major", "Trí tuệ Nhân tạo"), ("trí tuệ nhân tạo", "major", "Trí tuệ Nhân tạo"),
    ("khdl", "major", "Khoa học Dữ liệu"), ("data science", "major", "Khoa học Dữ liệu"),
    ("điện điện tử", "major", "Điện - Điện tử"), ("điện tử viễn thông", "major", "Điện - Điện tử"),
    ("tự động hóa", "major", "Điện - Điện tử"), ("vi mạch", "major", "Thiết kế Vi mạch"),
    ("bán dẫn", "major", "Kỹ thuật Bán dẫn"), ("cơ khí", "major", "Kỹ thuật Cơ khí"),
    ("cơ điện tử", "major", "Kỹ thuật Cơ Điện tử"), ("robot", "major", "Kỹ thuật Robot"),
    ("ô tô", "major", "Kỹ thuật Ô tô"), ("hàng không", "major", "Hàng không"),
    ("logistics", "major", "Logistics"), ("qlcn", "major", "Quản lý Công nghiệp"),
    ("y sinh", "major", "Y sinh"), ("hóa học", "major", "Hóa học"), ("thực phẩm", "major", "Thực phẩm"),
    ("sinh học", "major", "Sinh học"), ("xây dựng", "major", "Xây dựng"), ("kiến trúc", "major", "Kiến trúc"),
    ("môi trường", "major", "Môi trường"), ("dệt may", "major", "Dệt - May"), ("vật liệu", "major", "Kỹ thuật Vật liệu"),
    ("dầu khí", "major", "Kỹ thuật Dầu khí"), ("địa chất", "major", "Kỹ thuật Địa chất"),
    ("đường sắt", "major", "Kỹ thuật Đường sắt"), ("hạt nhân", "major", "Kỹ thuật Hạt nhân"),
    ("quản trị kinh doanh", "major", "Quản trị Kinh doanh"), ("qtkd", "major", "Quản trị Kinh doanh"),
    ("tiêu chuẩn", "program", "tieu_chuan"), ("đại trà", "program", "tieu_chuan"),
    ("chính quy", "program", "tieu_chuan"), ("tiếng anh", "program", "tieng_anh"),
    ("chất lượng cao", "program", "tieng_anh"), ("clc", "program", "tieng_anh"),
    ("tiên tiến", "program", "tien_tien"), ("định hướng nhật", "program", "dinh_huong_nhat"),
    ("nhật bản", "program", "dinh_huong_nhat"), ("chuyển tiếp", "program", "chuyen_tiep_quoc_te"),
    ("du học", "program", "chuyen_tiep_quoc_te"), ("liên kết", "program", "lien_ket_tne"),
    ("uts", "program", "lien_ket_tne"), ("tne", "program", "lien_ket_tne"),
    ("pfiev", "program", "pfiev"), ("việt pháp", "program", "pfiev"), ("tài năng", "program", "tai_nang"),
]

# v4 legacy markdown: keep only evergreen background sections (admission facts come from official pages).
LEGACY_KEEP = {
    "tonghop.md": {"1", "2", "3", "4", "5", "6", "7", "8", "9", "18", "20", "21", "22", "23", "24", "25", "26", "27"},
}


def strip_accents(s: str) -> str:
    s = unicodedata.normalize("NFD", s)
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return s.replace("đ", "d").replace("Đ", "D")


def slugify(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", strip_accents(s).lower()).strip("-")


def _num(text: str) -> float | None:
    t = text.strip().replace(",", ".")
    return float(t) if re.fullmatch(r"\d{1,3}(\.\d{1,2})?", t) else None


@dataclass
class Tables:
    programs: list[dict] = field(default_factory=list)
    majors: list[dict] = field(default_factory=list)
    admission_scores: list[dict] = field(default_factory=list)
    quotas: list[dict] = field(default_factory=list)
    subject_combinations: list[dict] = field(default_factory=list)
    partner_universities: list[dict] = field(default_factory=list)
    tuition: list[dict] = field(default_factory=list)
    english_conversion: list[dict] = field(default_factory=list)
    admission_timeline: list[dict] = field(default_factory=list)
    accreditation: list[dict] = field(default_factory=list)
    aliases: list[dict] = field(default_factory=list)


# ──────────────────────────────────────────────
# Official score / quota table
# ──────────────────────────────────────────────
def _program_for_header(header: str) -> str | None:
    for pid, _, _, _, key in PROGRAMS:
        if key and key in header.upper():
            return pid
    return None


_COUNTRIES = r"(?:Úc|New Zealand|Mỹ|Châu Âu|Nhật Bản)"
_PARTNER_RE = rf"({_COUNTRIES})\s*:\s*(.*?)(?={_COUNTRIES}\s*:|$)"


def _split_name(raw: str) -> tuple[str, bool, str, str]:
    """→ (name, is_new, specializations, partner_text)."""
    text = raw.replace("\xa0", " ")
    is_new = "(Ngành mới)" in text
    text = text.replace("(Ngành mới)", "")
    partners = ""
    m = re.search(r"Đại học đối tác.*", text, flags=re.S)
    if m:
        partners = " ".join(m.group(0).split())
        text = text[: m.start()]
    specs = ""
    m = re.search(r"\((?:Chuyên ngành|Ngành/Chuyên ngành|Ngành)\s*:(.*?)\)\s*$", " ".join(text.split()), flags=re.S)
    flat = " ".join(text.split())
    if m:
        specs = m.group(1).strip(" :")
        flat = flat[: m.start()].strip()
    else:
        m2 = re.search(r"\((Chuyên ngành của ngành[^)]*)\)", flat)
        if m2:
            specs = m2.group(1)
            flat = flat[: m2.start()].strip()
    return flat.strip(), is_new, specs, partners


def parse_score_table(snapshot: Path, t: Tables) -> None:
    src = SOURCE_BY_SLUG["nganh-va-chi-tieu"]
    raw_tables = json.loads((snapshot / "nganh-va-chi-tieu.tables.json").read_text(encoding="utf-8"))
    grid = expand_table(raw_tables[0])
    header_years = [c.text for c in grid[0]]
    assert "Điểm chuẩn năm 2026" in " ".join(header_years), "official table layout changed"

    # Columns: code | name | quota 2026 | combos | 2024 UTXT | 2024 TH | 2025 TH | 2026 TH
    score_cols = [(4, 2024, "UTXT"), (5, 2024, "TH"), (6, 2025, "TH"), (7, 2026, "TH")]
    program = None
    seen_programs: set[str] = set()
    for row in grid[2:]:
        first = row[0].text
        if row[0].spanned_cols >= 8 or not re.fullmatch(r"\d{3}", first):
            program = _program_for_header(first) or program
            continue
        code = first
        pid = program
        name, is_new, specs, partners = _split_name(row[1].raw or row[1].text)
        if pid == "chuyen_tiep_quoc_te" and code == "108":
            pid = "chuyen_tiep_nhat_ban"
        seen_programs.add(pid)
        major_id = f"{pid}:{code}"
        note = ""
        if row[4].spanned_cols >= 2 and not _num(row[4].text):
            note = row[4].text if row[4].text not in ("-", "") else ""
        t.majors.append({
            "major_id": major_id, "major_code": code, "program_id": pid, "name": name,
            "specializations": specs, "is_new": int(is_new), "note": note, "source_url": src.url,
        })
        q = row[2].text
        if q and q != "-" and q.isdigit():
            t.quotas.append({
                "year": 2026, "major_id": major_id, "major_code": code, "program_id": pid,
                "quota": int(q), "scope": "program_group" if row[2].spanned_rows > 1 else "major",
                "source_url": src.url,
            })
        for line in [x.strip() for x in (row[3].raw or row[3].text).split("\n") if x.strip()]:
            t.subject_combinations.append({"major_id": major_id, "major_code": code, "program_id": pid,
                                           "combination": " ".join(line.split()), "source_url": src.url})
        if partners:
            body = re.sub(r"^Đại học đối tác\s*(tại\s*)?:?\s*", "", partners)
            for country, unis in re.findall(_PARTNER_RE, body):
                for uni in [u.strip(" ,.") for u in unis.split(",") if u.strip(" ,.")]:
                    t.partner_universities.append({"major_id": major_id, "major_code": code, "program_id": pid,
                                                   "country": country, "university": uni, "source_url": src.url})
        for col, year, method in score_cols:
            cell = row[col]
            val = _num(cell.text)
            if val is not None:
                t.admission_scores.append({
                    "year": year, "major_id": major_id, "major_code": code, "program_id": pid,
                    "method": method, "score": val, "scale": 100, "source": "official", "source_url": src.url,
                })

    for pid, name, prefix, lang, _ in PROGRAMS:
        t.programs.append({"program_id": pid, "name": name, "code_prefix": prefix or "", "language": lang,
                           "has_codes": int(pid in seen_programs)})


# ──────────────────────────────────────────────
# Other official tables
# ──────────────────────────────────────────────
def parse_tuition(snapshot: Path, t: Tables) -> None:
    src = SOURCE_BY_SLUG["gioi-thieu-chung"]
    tables = json.loads((snapshot / "gioi-thieu-chung.tables.json").read_text(encoding="utf-8"))
    grid = expand_table(tables[0])
    years = [c.text for c in grid[0][1:]]
    mapping = {"Tiêu chuẩn": ["tieu_chuan", "tai_nang", "pfiev"],
               "Tiên tiến, Dạy & học bằng tiếng Anh": ["tien_tien", "tieng_anh"],
               "Định hướng Nhật Bản": ["dinh_huong_nhat"]}
    for row in grid[1:]:
        label = row[0].text
        group = next((k for k in mapping if k in label), None)
        if not group:
            continue
        for year, cell in zip(years, row[1:]):
            thousand = int(cell.text.replace(",", "").replace(".", ""))
            t.tuition.append({
                "academic_year": year, "program_group": group, "program_ids": ";".join(mapping[group]),
                "amount_vnd_per_year": thousand * 1000, "kind": "Học phí trung bình dự kiến",
                "source_url": src.url,
            })


def parse_english_conversion(snapshot: Path, t: Tables) -> None:
    src = SOURCE_BY_SLUG["quy-doi-chung-chi-anh"]
    tables = json.loads((snapshot / "quy-doi-chung-chi-anh.tables.json").read_text(encoding="utf-8"))
    grid = expand_table(tables[0])
    cols = ["ielts_academic", "pte_academic", "toefl_ibt", "toefl_ibt_2026", "toeic_listening_reading",
            "toeic_speaking_writing", "thpt_english_score"]
    for row in grid:
        cells = [" ".join(c.text.replace("≥", "≥ ").split()) for c in row[1:]]
        if len(cells) == 7 and _num(cells[-1].replace("≥", "").strip()) is not None and cells[0][0:1] in "≥0123456789":
            t.english_conversion.append({**dict(zip(cols, cells)), "source_url": src.url})


def parse_timeline(snapshot: Path, t: Tables) -> None:
    src = SOURCE_BY_SLUG["ket-qua-xet-tuyen"]
    lines = [x.strip() for x in (snapshot / "ket-qua-xet-tuyen.txt").read_text(encoding="utf-8").splitlines() if x.strip()]
    try:
        start = lines.index("Các mốc thời gian quan trọng") + 1
    except ValueError:
        return
    i = start
    while i + 1 < len(lines) and re.search(r"\d{2}/\d{2}/\d{4}", lines[i]):
        t.admission_timeline.append({"year": 2026, "when": lines[i], "event": lines[i + 1], "source_url": src.url})
        i += 2


# ──────────────────────────────────────────────
# Legacy (v4) data — provenance-tagged
# ──────────────────────────────────────────────
def parse_legacy(t: Tables) -> None:
    csv_dir = LEGACY_DIR / "csv"
    prog_by_file = {"1_12": "tieu_chuan", "2_13": "tien_tien", "3_14": "tieng_anh", "4_15": "dinh_huong_nhat"}
    known = {m["major_id"] for m in t.majors}
    for f in sorted(csv_dir.glob("*.csv")):
        pid = next((v for k, v in prog_by_file.items() if f.name.startswith(k)), None)
        if pid:
            for row in csv.DictReader(f.open(encoding="utf-8")):
                code = (row.get("Mã") or "").strip()
                major_id = f"{pid}:{code}"
                if major_id not in known:
                    continue
                for method in ("UTXT", "TH"):
                    val = _num((row.get(f"2023 ({method})") or "").strip())
                    if val is not None:
                        t.admission_scores.append({
                            "year": 2023, "major_id": major_id, "major_code": code, "program_id": pid,
                            "method": method, "score": val, "scale": 100, "source": "legacy_v4",
                            "source_url": f"legacy:{f.name}",
                        })
        if f.name.startswith("7_1"):
            for raw_row in csv.DictReader(f.open(encoding="utf-8")):
                row = {k: v.replace("*", "").strip() for k, v in raw_row.items()}
                t.accreditation.append({
                    "level": row["Bậc đào tạo"],
                    "majors_total": int(row["Số lượng (Theo ngành)"]), "programs_total": int(row["Số lượng (Theo CTĐT)"]),
                    "majors_accredited": int(row["Đạt kiểm định (Theo ngành)"]),
                    "programs_accredited": int(row["Đạt kiểm định (Theo CTĐT)"]),
                    "majors_rate": row["Tỉ lệ (Theo ngành)"], "programs_rate": row["Tỉ lệ (Theo CTĐT)"],
                    "source": "legacy_v4", "source_url": f"legacy:{f.name}",
                })


def build_aliases(t: Tables) -> None:
    seen = set()
    for m in t.majors:
        for alias in {m["name"].lower(), strip_accents(m["name"]).lower(), m["major_code"]}:
            key = (alias, m["major_id"])
            if key not in seen:
                seen.add(key)
                t.aliases.append({"alias": alias, "kind": "major_name", "target": m["major_id"]})
    for alias, kind, target in MANUAL_ALIASES:
        t.aliases.append({"alias": alias, "kind": kind, "target": target})


# ──────────────────────────────────────────────
# Documents
# ──────────────────────────────────────────────
def _front_matter(meta: dict) -> str:
    lines = ["---"]
    for k, v in meta.items():
        lines.append(f"{k}: {json.dumps(v, ensure_ascii=False)}")
    lines.append("---\n")
    return "\n".join(lines)


def _html_to_markdown(html: str, drop_tables: bool = False) -> str:
    soup = BeautifulSoup(html, "html.parser")
    main = soup.select_one("main#app") or soup.body
    sections = [s for s in main.select("section") if s.get_text(strip=True)] or [main]
    parts = []
    for sec in sections:
        for img in sec.find_all("img"):
            name = img.get("src", "").split("/")[-1].split("?")[0]
            if name in IMAGE_TRANSCRIPTIONS:
                p = soup.new_tag("p")
                strong = soup.new_tag("strong")
                strong.string = IMAGE_TRANSCRIPTIONS[name]
                p.append(strong)
                img.replace_with(p)
            else:
                img.decompose()
        for bad in sec.select("script, style, form, button, .modal"):
            bad.decompose()
        if drop_tables:
            for tb in sec.find_all("table"):
                tb.replace_with(soup.new_string("\n\n[Bảng ngành, chỉ tiêu và điểm chuẩn: xem dữ liệu có cấu trúc]\n\n"))
        parts.append(markdownify(str(sec), heading_style="ATX"))
    text = "\n\n".join(parts)
    text = re.sub(r"\]\((/[^)]+)\)", r"](https://hcmut.edu.vn\1)", text)
    text = re.sub(r"[ \t]+\n", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def write_official_documents(snapshot: Path) -> int:
    out = DOCUMENTS_DIR / "official"
    out.mkdir(parents=True, exist_ok=True)
    manifest = {m["slug"]: m for m in json.loads((snapshot / "manifest.json").read_text(encoding="utf-8")) if "error" not in m}
    n = 0
    for src in SOURCES:
        html_path = snapshot / f"{src.slug}.html"
        if src.slug not in manifest or not html_path.exists() or manifest[src.slug]["chars"] < 200:
            logger.warning("document_skipped", slug=src.slug, reason="missing or empty page")
            continue
        body = _html_to_markdown(html_path.read_text(encoding="utf-8"), drop_tables=src.has_score_table)
        meta = {"id": f"official/{src.slug}", "title": src.title, "topic": src.topic, "year": 2026,
                "source_type": "official", "source_url": src.url,
                "fetched_at": manifest[src.slug]["fetched_at"]}
        (out / f"{src.slug}.md").write_text(_front_matter(meta) + f"# {src.title}\n\n" + body + "\n", encoding="utf-8")
        n += 1
    return n


def write_major_cards(t: Tables) -> int:
    """One generated doc per major so retrieval can find majors by description / specialization."""
    out = DOCUMENTS_DIR / "majors"
    out.mkdir(parents=True, exist_ok=True)
    for f in out.glob("*.md"):
        f.unlink()
    scores: dict[str, list[dict]] = {}
    for s in t.admission_scores:
        scores.setdefault(s["major_id"], []).append(s)
    quotas = {q["major_id"]: q for q in t.quotas}
    combos: dict[str, list[str]] = {}
    for c in t.subject_combinations:
        combos.setdefault(c["major_id"], []).append(c["combination"])
    partners: dict[str, list[str]] = {}
    for p in t.partner_universities:
        partners.setdefault(p["major_id"], []).append(f'{p["university"]} ({p["country"]})')

    for m in t.majors:
        mid = m["major_id"]
        lines = [f"# {m['name']} — mã {m['major_code']} — {PROGRAM_NAME[m['program_id']]}", ""]
        if m["is_new"]:
            lines.append("- Ngành mới tuyển sinh.")
        if m["specializations"]:
            lines.append(f"- Ngành/chuyên ngành đào tạo: {m['specializations']}.")
        if mid in quotas:
            q = quotas[mid]
            scope = " (chỉ tiêu chung của cả chương trình)" if q["scope"] == "program_group" else ""
            lines.append(f"- Chỉ tiêu năm 2026: {q['quota']}{scope}.")
        if combos.get(mid):
            lines.append("- Tổ hợp xét tuyển: " + " | ".join(combos[mid]) + ".")
        for s in sorted(scores.get(mid, []), key=lambda x: (x["year"], x["method"])):
            label = "Xét tuyển Tổng hợp" if s["method"] == "TH" else "Ưu tiên xét tuyển (UTXT)"
            lines.append(f"- Điểm chuẩn năm {s['year']} ({label}, thang 100): {s['score']:.2f}.")
        if partners.get(mid):
            lines.append("- Đại học đối tác: " + ", ".join(partners[mid]) + ".")
        if m["note"]:
            lines.append(f"- Ghi chú: {m['note']}")
        meta = {"id": f"majors/{m['program_id']}-{m['major_code']}", "title": f"{m['name']} ({m['major_code']})",
                "topic": "nganh_hoc", "year": 2026, "source_type": "generated_from_official",
                "source_url": m["source_url"], "program_id": m["program_id"], "major_codes": [m["major_code"]]}
        (out / f"{m['program_id']}-{m['major_code']}.md").write_text(_front_matter(meta) + "\n".join(lines) + "\n",
                                                                       encoding="utf-8")
    return len(t.majors)


def write_legacy_documents() -> int:
    out = DOCUMENTS_DIR / "legacy"
    out.mkdir(parents=True, exist_ok=True)
    for f in out.glob("*.md"):
        f.unlink()
    n = 0
    for fname, keep in LEGACY_KEEP.items():
        path = LEGACY_DIR / "raw" / fname
        if not path.exists():
            continue
        text = unicodedata.normalize("NFC", path.read_text(encoding="utf-8"))
        for block in re.split(r"(?=^## \d+\. )", text, flags=re.M):
            m = re.match(r"^## (\d+)\. (.+)", block)
            if not m or m.group(1) not in keep:
                continue
            title = m.group(2).strip()
            meta = {"id": f"legacy/{slugify(title)}", "title": title, "topic": "kien_thuc_chung", "year": 2025,
                    "source_type": "legacy_v4", "source_url": f"legacy:{fname}#{m.group(1)}"}
            body = re.sub(r"^## \d+\. ", "# ", block.strip(), count=1)
            (out / f"{int(m.group(1)):02d}-{slugify(title)[:60]}.md").write_text(_front_matter(meta) + body + "\n",
                                                                               encoding="utf-8")
            n += 1
    return n


def _write_csv(name: str, rows: list[dict]) -> None:
    STRUCTURED_DIR.mkdir(parents=True, exist_ok=True)
    path = STRUCTURED_DIR / f"{name}.csv"
    if not rows:
        path.write_text("", encoding="utf-8")
        return
    with path.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        w.writeheader()
        w.writerows(rows)


def parse_all(snapshot_name: str | None = None) -> dict:
    snapshot = latest_snapshot() if snapshot_name is None else latest_snapshot().parent / snapshot_name
    t = Tables()
    parse_score_table(snapshot, t)
    parse_tuition(snapshot, t)
    parse_english_conversion(snapshot, t)
    parse_timeline(snapshot, t)
    parse_legacy(t)
    build_aliases(t)
    for name, rows in vars(t).items():
        _write_csv(name, rows)
    docs = {
        "official": write_official_documents(snapshot),
        "majors": write_major_cards(t),
        "legacy": write_legacy_documents(),
    }
    return {"snapshot": snapshot.name, "tables": {k: len(v) for k, v in vars(t).items()}, "documents": docs}
