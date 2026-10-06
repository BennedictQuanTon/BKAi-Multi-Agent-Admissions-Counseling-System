"""Build the typed facts database (SQLite) and the knowledge-base manifest."""

from __future__ import annotations

import csv
import hashlib
import json
import sqlite3
from datetime import datetime, timezone

from config.settings import BUILD_DIR, DOCUMENTS_DIR, STRUCTURED_DIR, get_settings

SCHEMA = """
CREATE TABLE programs (program_id TEXT PRIMARY KEY, name TEXT, code_prefix TEXT, language TEXT, has_codes INTEGER);
CREATE TABLE majors (major_id TEXT PRIMARY KEY, major_code TEXT, program_id TEXT REFERENCES programs,
                     name TEXT, specializations TEXT, is_new INTEGER, note TEXT, source_url TEXT);
CREATE TABLE admission_scores (year INTEGER, major_id TEXT REFERENCES majors, major_code TEXT, program_id TEXT,
                     method TEXT, score REAL, scale INTEGER, source TEXT, source_url TEXT,
                     PRIMARY KEY (year, major_id, method));
CREATE TABLE quotas (year INTEGER, major_id TEXT REFERENCES majors, major_code TEXT, program_id TEXT,
                     quota INTEGER, scope TEXT, source_url TEXT, PRIMARY KEY (year, major_id));
CREATE TABLE subject_combinations (major_id TEXT REFERENCES majors, major_code TEXT, program_id TEXT,
                     combination TEXT, source_url TEXT);
CREATE TABLE partner_universities (major_id TEXT REFERENCES majors, major_code TEXT, program_id TEXT,
                     country TEXT, university TEXT, source_url TEXT);
CREATE TABLE tuition (academic_year TEXT, program_group TEXT, program_ids TEXT, amount_vnd_per_year INTEGER,
                     kind TEXT, source_url TEXT);
CREATE TABLE english_conversion (ielts_academic TEXT, pte_academic TEXT, toefl_ibt TEXT, toefl_ibt_2026 TEXT,
                     toeic_listening_reading TEXT, toeic_speaking_writing TEXT, thpt_english_score TEXT, source_url TEXT);
CREATE TABLE admission_timeline (year INTEGER, "when" TEXT, event TEXT, source_url TEXT);
CREATE TABLE accreditation (level TEXT, majors_total INTEGER, programs_total INTEGER, majors_accredited INTEGER,
                     programs_accredited INTEGER, majors_rate TEXT, programs_rate TEXT, source TEXT, source_url TEXT);
CREATE TABLE aliases (alias TEXT, kind TEXT, target TEXT);
CREATE INDEX idx_scores_code ON admission_scores(major_code, year);
CREATE INDEX idx_majors_code ON majors(major_code);
CREATE INDEX idx_alias ON aliases(alias);
"""

TABLES = ["programs", "majors", "admission_scores", "quotas", "subject_combinations", "partner_universities",
          "tuition", "english_conversion", "admission_timeline", "accreditation", "aliases"]


def _kb_version() -> str:
    h = hashlib.sha256()
    for path in sorted([*STRUCTURED_DIR.glob("*.csv"), *DOCUMENTS_DIR.rglob("*.md")]):
        h.update(path.name.encode())
        h.update(path.read_bytes())
    return h.hexdigest()[:12]


def build() -> dict:
    settings = get_settings()
    BUILD_DIR.mkdir(parents=True, exist_ok=True)
    db_path = settings.facts_db_path
    tmp = db_path.with_suffix(".tmp")
    tmp.unlink(missing_ok=True)
    con = sqlite3.connect(tmp)
    con.executescript(SCHEMA)
    counts = {}
    for name in TABLES:
        path = STRUCTURED_DIR / f"{name}.csv"
        rows = list(csv.DictReader(path.open(encoding="utf-8"))) if path.stat().st_size else []
        if rows:
            cols = list(rows[0].keys())
            con.executemany(
                f"INSERT INTO {name} ({', '.join(chr(34) + c + chr(34) for c in cols)}) VALUES ({', '.join('?' * len(cols))})",
                [tuple(r[c] for c in cols) for r in rows],
            )
        counts[name] = len(rows)
    con.commit()
    con.close()
    tmp.replace(db_path)  # atomic swap so a running API never reads a half-built DB

    docs = {d.name: len(list(d.glob("*.md"))) for d in DOCUMENTS_DIR.iterdir() if d.is_dir()}
    manifest = {
        "kb_version": _kb_version(),
        "built_at": datetime.now(timezone.utc).isoformat(),
        "tables": counts,
        "documents": docs,
        "facts_db": str(db_path.relative_to(BUILD_DIR.parent.parent)),
    }
    settings.manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=1), encoding="utf-8")
    return manifest
