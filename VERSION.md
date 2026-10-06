# BKAi — Version history (v1 → v5)

How the system evolved, what each version replaced, and which technique moved which metric.
Numbers are labelled by where they come from, so they are never mixed up:

- **claimed**: written in that version's README, with no reproducible artifact in the repo
- **measured**: produced by a script in this repo whose report is committed (`backend/evaluation/reports/*.json`)
- **audit**: v4 code re-run by hand on 2026-10-05, before v5 changes (see `docs/PLAN_v5.md` §1)

---

## 1 · At a glance

| | **v1.0.0** | **v2.0.0** | **v3.0.0** | **v4.0.0** | **v5.0.0** |
|---|---|---|---|---|---|
| Date | 2026-05-14 → 05-20 | 2026-07-12 | 2026-07-15 | 2026-07-16 | 2026-10-06 |
| Theme | Local-only agentic RAG | Move to Gemini API + React | Voice agent, golden set | Counselor graph, owner loop | **Multi-agent, facts-first, measured** |
| LLM | Ollama `llama3.2` 3B + `qwen2.5` 7B | Gemini 2.5 Flash-Lite | Gemini 3.1 Flash-Lite | Gemini 3.1 Flash-Lite | **Gemini 3.5 Flash-Lite** + quota-aware failover to 3.1 |
| LLM calls / answer | 4 (rewrite, evaluate, generate, reflect) + loops | 4 + loops | 4 + loops | 3–6 | **0–2** (fast path: 1) |
| Orchestration | LangGraph linear + multi-hop loop | same | same | counselor graph + RAG graph | **Supervisor → parallel specialists → Synthesizer → Verifier** |
| Knowledge | MD + CSV chunks | + PDF/DOCX | 115 docs / 150 chunks | same | **11 SQL fact tables** + 340 contextual chunks, crawled from hcmut.edu.vn |
| Vector DB | ChromaDB | ChromaDB (Qdrant removed) | ChromaDB | ChromaDB | **Qdrant** (dense + sparse named vectors, server-side RRF) |
| Embedding | MiniLM-L12 multilingual | MiniLM-L12 | MiniLM-L12 | MiniLM-L12 | **AITeamVN/Vietnamese_Embedding_v2** (1024-d) |
| Lexical | rank-bm25 (in memory) | rank-bm25 | rank-bm25 | rank-bm25 | **BM25 sparse vectors in Qdrant** (IDF server-side) |
| Reranker | ms-marco-MiniLM-L-6 (English) | bge-reranker-base | bge-reranker-base | bge-reranker-base | bge-reranker-base, **tuned** (len 384, 12 candidates) |
| Cache | Redis 7 cosine | Redis Stack HNSW | Redis Stack HNSW | Redis Stack HNSW ≥ 0.92, auto-labelled | **Qdrant answer cache, entity-guarded, owner-approved only, kb_version-scoped** |
| Memory | conversation buffer | same | same | session state + query rewriter | **No accounts: per-device id + transcripts in the browser; Redis sessions (12 msgs, 7 days) + structured StudentProfile** |
| STT | — | faster-whisper `base` | + LiveKit | LiveKit + Deepgram Nova | **AssemblyAI Universal-3.6 Pro streaming** (Whisper large-v3-turbo fallback) |
| TTS | — | edge-tts (cloud) | edge-tts | edge-tts | **Kokoro-Vietnamese local, clause-streamed** + VN number normalizer |
| Tools / MCP | — | — | — | — | **MCP server, 11 read-only tools** |
| Frontend | Vanilla JS + Chart.js | React 19 + TS + Tailwind v4 + Recharts | same | same + legacy dashboard | **Rebuilt per DESIGN.md**: framer-motion, custom SVG charts, Observability popup; **landing page at `/`** with a 60-s film |
| Brand | — | robot-bubble logo | same | same | **Bách Khoa cube that speaks** (original mark, Bách Khoa blues) |
| Observability | Redis counters | dashboard, agent trace | same | live query console | **Per-query waterfall, TTFT/TPOT/tokens per Gemini call, retrieved chunks, health of 11 components** |
| Security | none | regex + LLM scope guard, RPM lock | same | same | **OWASP LLM 2026 mapping**: PII redaction, per-IP quotas, WS Origin allow-list, admin token, CSP/HSTS, Caddy TLS |
| Tests | — | — | 20-case demo script | — | **36 unit tests + 6 e2e suites (200 factual, 60 guard) + retrieval (198 q) / TTS / voice benches** |

## 2 · Accuracy

| Version | What was reported | Source | What the audit found |
|---|---|---|---|
| v1 | "100% (5/5) retrieval accuracy" | claimed | — |
| v2 | "100% grounded" | claimed | — |
| v3 | 96.8% on 250 golden Q&A | claimed | — |
| v4 | ~87% end-to-end on n=120; guard ~98%; multi-turn ~94% | claimed | **4/5 real cases, 5/6 turns** (Wilson 95% CI ≈ 38–96%). C2 answered **the wrong year** (asked 2025, got 2024 numbers). The cache could return **another major's** answer. |
| **v5** | see below | **measured** | — |

**v5 measured** (`backend/evaluation/reports/e2e_bench.json`, live API, Gemini 3.5 Flash-Lite):

| Suite | Result |
|---|---|
| 8 cases (2 easy · 2 medium · 2 hard · 2 out-of-scope) | **8 / 8** |
| Factual exact-match (150 cut-offs + 50 quotas, generated from the fact DB), n = 200 | **200 / 200** (Wilson 95% CI 0.981–1.0) |
| Guardrail probes (31 to refuse · 29 to answer), n = 60 | **60 / 60**, precision **1.0**, recall **1.0** |
| Student end-to-end conversation, 9 turns | **9 / 9** |
| Memory: remembers score + major after N distractor turns | still correct after **7 turns** (beyond the 12-message window) |
| Verifier pass rate (every number in the answer found in evidence) | **100%** |
| Retrieval, 198 queries: Hit@1 / Hit@5 / MRR@10 | **0.828 / 0.955 / 0.883** (80-query selection run: 0.875 / 0.950 / 0.912) |
| Before the final fixes (same suites) | 199 / 200 factual, 57 / 60 guard: a resolver gap and three missed universities, fixed and re-run (`reports/history/`) |

## 3 · Latency

| Version | Cold answer | Cache hit | Source |
|---|---|---|---|
| v1 | 40–60 s (local CPU) | < 0.1 s | claimed |
| v2 | 1–3 s LLM generation | < 0.1 s | claimed |
| v3 | 9.47 s average | < 0.05 s | claimed |
| v4 | claimed p50 5.6 s · **audit p50 27.3 s, max 56.6 s, TTFT p50 17.7 s**; first request 38.1 s (reranker lazy-load) | claimed 0.04 s | audit |
| **v5** | **p50 1.79 s · p95 5.0 s · TTFT p50 1.11 s** (8 cases) · factual p50 1.35 s, TTFT p50 0.76 s | **p50 344 ms at 20 concurrent** | measured |

v5 under load: 6 concurrent LLM answers → p50 1.65 s, p95 2.12 s, **0 errors, 0 cross-session leaks**.
Voice: end of speech → final transcript **579 ms** (p50), → first audio **2.55 s**; AssemblyAI CER **1.26%**, 3/3 correct answers.

**v4 → v5: cold p50 27.3 s → 1.79 s (15× faster), TTFT 17.7 s → 1.11 s (16×).**

## 4 · What replaced what, and why it mattered

| # | Replaced | With (v5) | Problem it solved | Measured effect |
|---|---|---|---|---|
| 1 | Global LangChain token callback | per-request `contextvars` **EventBus** | v4 streamed one user's tokens into another user's socket under concurrency | 0 leaks in 20 + 6 concurrent load tests |
| 2 | Cosine-only semantic cache, auto-"correct" labelling | **entity-guarded** cache: same major/program/year/method key, same `kb_version`, owner-approved only | "KHMT 2025" and "KTMT 2025" are > 0.92 similar, so v4 served the wrong major | a question about another major is a cache miss by construction (entity key differs); unit-tested |
| 3 | Numbers retrieved as text chunks | **typed SQL fact DB** (11 tables) + entity resolver (codes, aliases, accent-free) | wrong year / wrong program (v4 case C2) | factual 200/200 |
| 4 | LLM self-reflection node | **deterministic verifier**: every number in the answer must exist in evidence, one repair pass | LLM judge was slow and missed wrong numbers | 100% pass, ~0.5 ms instead of a Gemini call |
| 5 | Query rewriter + evaluator + generator + reflector (4 LLM calls) | **fast path** (rules + resolver, 1 LLM call) or Supervisor plan (2 calls) | RPM pressure and multi-second chains | 556 / 792 requests answered by the fast path; 1.01 LLM calls per answer |
| 6 | "Multi-hop" loop that re-ran the same search | **CRAG-style corrective hop**: reformulate only when the best rerank score < 0.15 | extra latency without new evidence | policy stage p50 0.71 s |
| 7 | MiniLM-L12 embedding | **Vietnamese_Embedding_v2** | weak Vietnamese semantics | Hit@1 0.475 → 0.813 (same 198 queries, hybrid, no rerank) |
| 8 | In-memory rank-bm25 + Chroma, fused in Python | **Qdrant** named vectors dense + BM25 sparse, **RRF inside Qdrant** | two indexes drifting apart, no filtering by program | hybrid Hit@5 0.963 at 40 ms |
| 9 | Reranker at default settings (len 512, 20 candidates) | **len 384, 12 candidates**, warmed at startup | 682 ms rerank on CPU; 38 s first request | policy Hit@1 0.74 → 0.82 (198 q); 276–307 ms p50; no cold-start |
| 10 | Flat 500-token chunks | **parent/child contextual chunks** ("title › section" prefix, child ≤ 900 chars, parent ≤ 2,400) | tables and formulas cut mid-row | formulas and tables kept whole; 340 chunks |
| 11 | Hand-copied CSV/MD (2023–2025, no 2026 cut-offs) | **datahub**: Playwright crawl of 16 official pages → parse (rowspan/colspan) → validation gate → atomic build | stale data, silent errors | Σ quota = official 5,685; 67/67 cross-checked scores |
| 12 | Blocking CPU work inside async handlers | `asyncio.to_thread` + model warm-up in lifespan | one rerank froze every socket | 6 concurrent answers without errors |
| 13 | Fixed RPM lock that raised errors | **quota-aware ModelPool** (14 RPM/model sliding window, failover on 429/503 before the first token) | free-tier 429s surfaced to users | 785 / 792 requests answered (7 polite "busy" replies in a deliberate over-quota burst); failover visible in Observability |
| 14 | Deepgram via LiveKit / faster-whisper `base` | **AssemblyAI Universal-3.6 Pro** streaming with HCMUT keyterms | major names and codes misheard | CER 1.26%, final transcript 579 ms after speech |
| 15 | edge-tts (cloud, 3.8 s to first byte) | **Kokoro-Vietnamese** local + number/acronym normalizer | slow first audio, digits read badly | first byte 591 ms (6.5× faster) |
| 16 | Regex scope guard + LLM backup | rules for clear cases (incl. "<university> + name" and comparisons), **Supervisor decides the uncertain ones**; acronyms matched case-sensitively | "Nếu" was blocked as university "NEU"; jokes/code passed on the fast path; three other universities slipped through | guard 60/60, student 9/9 |
| 17 | Ad-hoc dashboard | **Observability**: per-query waterfall, Gemini TTFT/TPOT/tokens, chunks + rerank scores, live via `/ws/dashboard` | slow turns could not be explained | found that a 10.5 s turn was failover TTFT, not retrieval |
| 18 | Open API | PII redaction, per-IP minute/day quotas, WS Origin + per-IP socket cap, admin token, security headers, Caddy TLS | not deployable publicly | see `docs/DEPLOYMENT.md` |

## 5 · Lessons carried forward

- **Measure before claiming.** v1–v4 numbers had no artifacts; v4's real latency was about 5× its README.
  v5 commits every benchmark script and report.
- **Numbers belong in a database, not in chunks.** Retrieval is for policy text. Cut-offs, quotas and
  tuition come from typed tables, so they cannot be mixed up across years.
- **Fewer, better LLM calls** beat chains of LLM judges on a 15-RPM free tier: 0–2 calls, plus a verifier in code.
- **Pick models by benchmark on your own data.** The Vietnamese-specific reranker scored *lower*
  (Hit@1 0.787) than bge-reranker-base (0.875) on this corpus.
