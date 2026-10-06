# BKAi knowledge base layout

Everything under this folder except this file is generated locally and git-ignored.
Rebuild end-to-end with:

```bash
cd backend
python -m datahub all      # crawl → parse → validate → build
python ingest.py           # chunk → embed → index into Qdrant
```

```
data/
├── sources/<YYYY-MM-DD>/     raw crawl snapshot of official hcmut.edu.vn pages
│   ├── <slug>.html|.txt|.tables.json
│   ├── assets/               images whose content is transcribed by hand (e.g. formulas)
│   └── manifest.json         url · fetched_at · sha256 · size per page
├── curated/                  human-reviewable canonical data (one fact = one row)
│   ├── structured/*.csv      11 fact tables (see below)
│   └── documents/
│       ├── official/         15 official pages → Markdown + YAML front-matter
│       ├── majors/           74 generated "major cards" (one per admission code)
│       └── legacy/           18 evergreen background sections kept from the v4 KB
├── build/
│   ├── facts.sqlite          typed fact DB used by the Admissions-Data agent (SQL tools)
│   ├── qdrant/               embedded Qdrant collection (dense + sparse) when QDRANT_URL is empty
│   ├── validation_report.json
│   └── manifest.json         kb_version (content hash) · row counts · build time
└── legacy/                   v4 raw files, kept only for provenance and cross-checks
```

## Fact tables (`curated/structured`, mirrored in `build/facts.sqlite`)

| Table | Grain | Source |
|---|---|---|
| `programs` | 1 row / training program (9) | official |
| `majors` | 1 row / admission code within a program (74) | official |
| `admission_scores` | year × major × method (2023–2026; TH, UTXT) | official (2024–26) · legacy (2023) |
| `quotas` | year × major, with `scope` = major / program_group | official |
| `subject_combinations` | major × combination | official |
| `partner_universities` | major × partner university | official |
| `tuition` | academic year × program group (VND/year) | official |
| `english_conversion` | certificate band → THPT English score | official |
| `admission_timeline` | key 2026 dates | official |
| `accreditation` | level × counts/rates | legacy |
| `aliases` | alias → major / program (KHMT, CLC, UTS…) | generated + curated |

Validation gate (`python -m datahub validate`): unique keys, 40 ≤ score ≤ 100, referential integrity,
total 2026 quota must equal the officially announced 5,685, and 2024–2025 scores are cross-checked
against the independent v4 CSVs.
