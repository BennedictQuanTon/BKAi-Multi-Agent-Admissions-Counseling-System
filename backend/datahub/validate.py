"""Data-quality gate for curated tables. Errors block the build; warnings are reported."""

from __future__ import annotations

import csv
import json
import re
from collections import Counter

from config.settings import BUILD_DIR, LEGACY_DIR, STRUCTURED_DIR

OFFICIAL_TOTAL_QUOTA_2026 = 5685  # "khoảng 5.685 chỉ tiêu" — gioi-thieu-chung (2026)


def _read(name: str) -> list[dict]:
    path = STRUCTURED_DIR / f"{name}.csv"
    return list(csv.DictReader(path.open(encoding="utf-8"))) if path.stat().st_size else []


def validate() -> dict:
    errors: list[str] = []
    warnings: list[str] = []
    majors = _read("majors")
    scores = _read("admission_scores")
    quotas = _read("quotas")

    ids = Counter(m["major_id"] for m in majors)
    errors += [f"duplicate major_id {k}" for k, v in ids.items() if v > 1]
    known = set(ids)
    for m in majors:
        if not re.fullmatch(r"\d{3}", m["major_code"]):
            errors.append(f"bad major_code {m['major_code']}")
        if not m["name"]:
            errors.append(f"empty name {m['major_id']}")

    keys = Counter((s["year"], s["major_id"], s["method"]) for s in scores)
    errors += [f"duplicate score {k}" for k, v in keys.items() if v > 1]
    for s in scores:
        v = float(s["score"])
        if not 40.0 <= v <= 100.0:
            errors.append(f"score out of range {s}")
        if s["major_id"] not in known:
            errors.append(f"score for unknown major {s['major_id']}")

    by_scope = Counter()
    for q in quotas:
        by_scope[q["scope"]] += int(q["quota"]) if q["scope"] == "major" else 0
    group_quotas = {int(q["quota"]) for q in quotas if q["scope"] == "program_group"}
    total = by_scope["major"] + sum(group_quotas)
    if total != OFFICIAL_TOTAL_QUOTA_2026:
        warnings.append(f"total quota {total} != official {OFFICIAL_TOTAL_QUOTA_2026}")

    # Cross-check: official 2024/2025 scores vs. the v4 legacy CSVs (independent copy of the same facts).
    cross = {"checked": 0, "mismatch": []}
    legacy_file = next((LEGACY_DIR / "csv").glob("1_12_*.csv"), None)
    if legacy_file:
        official = {(s["major_code"], s["year"], s["method"]): float(s["score"])
                    for s in scores if s["program_id"] == "tieu_chuan" and s["source"] == "official"}
        for row in csv.DictReader(legacy_file.open(encoding="utf-8")):
            for year, method in (("2024", "UTXT"), ("2024", "TH"), ("2025", "TH")):
                raw = (row.get(f"{year} ({method})") or "").strip()
                key = (row["Mã"].strip(), year, method)
                if re.fullmatch(r"\d+(\.\d+)?", raw) and key in official:
                    cross["checked"] += 1
                    if abs(float(raw) - official[key]) > 1e-6:
                        cross["mismatch"].append({"key": key, "legacy": float(raw), "official": official[key]})
    if cross["mismatch"]:
        warnings.append(f"{len(cross['mismatch'])} legacy/official score mismatches")

    report = {
        "summary": {"errors": len(errors), "warnings": len(warnings), "majors": len(majors),
                    "scores": len(scores), "total_quota_2026": total,
                    "legacy_cross_check": f"{cross['checked'] - len(cross['mismatch'])}/{cross['checked']} match"},
        "errors": errors, "warnings": warnings, "cross_check": cross,
    }
    BUILD_DIR.mkdir(parents=True, exist_ok=True)
    (BUILD_DIR / "validation_report.json").write_text(json.dumps(report, ensure_ascii=False, indent=1), encoding="utf-8")
    return report
