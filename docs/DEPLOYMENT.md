# BKAi v5 — Deployment plan & security model

Target: a real pilot with prospective students (hundreds of users/day, bursts during cut-off week), one VM,
managed TLS, no Kubernetes needed. Everything below is implemented in the repo unless marked *(ops)*.

## 0 · Pilot deploy, step by step (≈ 10 users/day)

A pilot of about 10 students a day asking a few questions each comes to 30–100 questions/day. One small VM is enough:
- 4 vCPU / 8 GB RAM, 30 GB disk. The embedding, reranker and Kokoro models run on CPU.
- The free Gemini tier covers it: the pool allows about 28 requests/minute across two models, and each answer uses 1.01 LLM calls on average.

| # | Do | Check |
|---|---|---|
| 1 | Create the VM (Ubuntu 24.04) and point an `A` record (e.g. `bkai.example.com`) at its IP. Open only ports 22, 80 and 443 | `dig +short bkai.example.com` returns the VM IP |
| 2 | Install Docker Engine and the compose plugin; `git clone` the repo | `docker compose version` |
| 3 | On your laptop: `cd backend && python -m datahub all`. The crawler needs Chrome. Then `rsync -a backend/data/ vm:~/bkai2/backend/data/` | `backend/data/build/facts.sqlite` exists on the VM |
| 4 | `cp backend/.env.example backend/.env` and set `GOOGLE_API_KEY`, `ASSEMBLYAI_API_KEY` (optional), `ADMIN_TOKEN` (long random string) and `APP_ENV=production`. In the repo-root `.env`, set `BKAI_DOMAIN` and `QDRANT_API_KEY` | `grep -c = backend/.env` |
| 5 | `docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build` | `docker compose ps`: all healthy. The first boot downloads models (~3 GB) into the `hf_models` volume |
| 6 | Index the documents into the Qdrant server: `docker compose -f docker-compose.yml -f docker-compose.prod.yml run --rm backend python ingest.py` | it prints `340 points` |
| 7 | Smoke test from anywhere | `curl https://$BKAI_DOMAIN/api/health` → `"status":"ok"`; open `/` → **Try it** → ask a question; try voice on a phone |
| 8 | Owner tools | open `/dashboard` and paste `ADMIN_TOKEN` when asked; Observability uses the same token |

**What a visitor gets, with no account:**
- **On the device:** a random session id, the list of recent chats and their transcripts, all in `localStorage`. Closing the tab or coming back tomorrow resumes the same conversation.
- **On the server:** Redis keeps the conversation memory and the student profile (scores, interests) for 7 days, keyed only by that random id.
- **Shared computers:** **Xoá dữ liệu trên máy này** in the sidebar clears both. Invalid or placeholder session ids (`"default"` …) are replaced server-side, so two users can never share a memory.

**Costs at this scale:**
- VM: about US$15–40/month.
- Gemini: $0 on the free tier.
- AssemblyAI: billed per streamed second. Voice sessions are capped at 10 minutes.

## 1 · Topology

```
Internet ──► Caddy :443 (auto-HTTPS, HSTS, CSP, 64 KB body cap, JSON access log)
               ├── /            → frontend (nginx, static SPA: landing at /, app at /chat)
               ├── /api/*, /ws/* → backend (FastAPI, 1 process, uvicorn) ──► Gemini API (egress only)
               └── /mcp*        → 404 (MCP is reached over SSH tunnel only)
internal network: backend ↔ redis (AOF, 256 MB LRU) · backend ↔ qdrant (API key) · HF model cache volume
```

`docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build` with `.env` containing
`BKAI_DOMAIN`, `ADMIN_TOKEN`, `QDRANT_API_KEY`, `GOOGLE_API_KEY`, `ASSEMBLYAI_API_KEY`.

**Sizing:** 4 vCPU / 8 GB RAM (embedding 2.2 GB + reranker 1.1 GB + Kokoro + Whisper on CPU). A small GPU
(T4/L4) cuts rerank from ~300 ms to <60 ms but is optional. Disk: 15 GB for model cache + data.

## 2 · Security controls mapped to OWASP Top 10 for LLM Applications (2026)

| Risk | Control in BKAi v5 | Where |
|---|---|---|
| Prompt injection (direct & indirect) | rule guard rejects injection phrasing (<1 ms); synthesizer prompt states EVIDENCE and the question are **data, not instructions**; tools are read-only, so a fooled model cannot act | `services/guardrails.py`, `config/prompts.py` |
| Sensitive information disclosure | CCCD / phone / email **redacted before** the LLM, Redis memory, telemetry and logs; no user accounts; anonymous sessions expire after 7 days; ids are validated and placeholders rejected; telemetry capped at 500 records | `services/pii.py`, `memory/session_store.py` |
| Excessive agency | agents only call deterministic, read-only tools (SQL SELECT, search, calculators); no write tools exist | `tools/admissions.py` |
| Misinformation | numbers only from the typed facts DB; **deterministic verifier** checks every number in the answer against evidence and rewrites once; unanswerable years are stated as such | `agents/data_agent.py`, `agents/verifier.py` |
| Unbounded consumption | per-IP quotas (20/min, 300/day in prod), ≤ 6 WebSockets per IP, 500-char input cap, 64 KB body cap, voice sessions capped at 10 min (AssemblyAI bills per second), quota-aware LLM pool with failover instead of retry storms, 0–2 LLM calls per answer | `api/security.py`, `services/llm.py` |
| Data & model poisoning | knowledge base built only from official hcmut.edu.vn pages; validation gate (unique keys, ranges, Σ quota = official 5,685, cross-check vs independent copy) blocks bad builds; content-hashed `kb_version` | `datahub/` |
| Hidden context exposure | no secrets in prompts; `/docs` + OpenAPI disabled in production; admin & observability endpoints require `X-Admin-Token` (constant-time compare); app refuses to start in production without it | `main.py`, `api/security.py` |
| Vector & embedding weaknesses | Qdrant on the internal network with API key; answer cache serves only **owner-approved** entries with identical entities and the same `kb_version` | `memory/answer_cache.py` |
| Improper output handling | answers rendered with react-markdown (no raw HTML), links `rel=noreferrer`, strict CSP from Caddy | `frontend/`, `deploy/Caddyfile` |
| Supply chain | pinned major versions, model weights from known HF orgs, non-root container user, `.env` never committed (verified in git history) | `requirements.txt`, `Dockerfile` |

Other web-layer controls: WebSocket **Origin allow-list** (CORS does not protect WebSockets),
`X-Forwarded-For` trusted only from the Caddy container, security headers on every response,
CORS limited to GET/POST with two headers, HSTS in production.

## 3 · Rollout plan

| Phase | Duration | Actions | Exit criteria |
|---|---|---|---|
| 0 · Staging | 1 day | VM + DNS, prod overlay, `datahub all` + `ingest`, run all suites against staging | 8/8 cases, factual ≥ 97 %, guard 100 %, no 5xx |
| 1 · Closed pilot | 1 week | 20–50 students from one high school; owner reviews every answer daily (Dashboard → Câu hỏi) | owner accuracy ≥ 95 % on reviewed answers, p95 < 6 s |
| 2 · Soft launch | 2 weeks | link from a fan page; raise quotas if needed; approve frequent answers into the cache | cache hit ≥ 30 %, error rate < 1 % |
| 3 · Peak season (cut-off week) | — | paid Gemini tier or add a second key/project; Qdrant + Redis snapshots daily *(ops)* | p95 < 6 s at 20 concurrent users |

## 4 · Operations

- **Monitoring:** Observability popup (health of 11 components, latency/TTFT/TPOT, tokens, confidence, categories);
  Caddy JSON logs → any log stack *(ops)*; uptime check on `/api/health` *(ops)*.
- **Data refresh:** `python -m datahub all && python ingest.py` weekly, daily during admission season; a failed
  validation stops the build and the running API keeps serving the previous `facts.sqlite` (atomic swap).
- **Backups:** Redis AOF + Qdrant snapshot volume nightly *(ops)*; the KB itself is reproducible from the crawl.
- **Secrets rotation:** Gemini / AssemblyAI keys and `ADMIN_TOKEN` via `.env` on the host only.
- **Cost guard:** free tier = 15 RPM/model → the pool (3.5 Flash-Lite + 3.1 Flash-Lite) gives ~28 LLM RPM ≈ 20–28
  answers/min. For launch, enable billing (tokens per answer are visible in Observability → model table).

## 5 · Known limits (be honest in demos)

- Single backend process (embedded models in-process) — scale out by moving embed/rerank to a TEI server.
- Free-tier Gemini quota is the throughput ceiling, not the code.
- Kokoro-Vietnamese is a community fine-tune: good intelligibility (CER ≈ Microsoft neural voices) but less natural prosody.
- `/api/chat` answers in Vietnamese only; English questions get Vietnamese answers.
