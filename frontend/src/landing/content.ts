// All copy, numbers and references for the landing page live here.
// Every metric points at the report that produced it (REFS). Change a number here and in the trailer
// (video/script.json, video/trailer.html) together.

export const REPO = "https://github.com/BennedictQuanTon/BKAi-Admission-System";
const blob = (path: string) => `${REPO}/blob/main/${path}`;

export type Ref = { id: number; label: string; source: string; href: string };

export const REFS: Ref[] = [
  { id: 1, label: "End-to-end benchmark: 8 cases, 200 factual, 60 guard probes, 9-turn student, memory, load (earlier runs kept in reports/history)", source: "backend/evaluation/reports/e2e_bench.json", href: blob("backend/evaluation/reports/e2e_bench.json") },
  { id: 2, label: "Request telemetry, 792 real requests: steady state vs. warm-up and provider incidents", source: "backend/evaluation/reports/telemetry_summary.json", href: blob("backend/evaluation/reports/telemetry_summary.json") },
  { id: 3, label: "Retrieval benchmark: 198 queries (every major, 2 phrasings + 50 policy), v4 vs v5; and the 80-query model selection run", source: "backend/evaluation/reports/retrieval_bench_scaled.json", href: blob("backend/evaluation/reports/retrieval_bench_scaled.json") },
  { id: 4, label: "Voice benchmark: AssemblyAI streaming STT + Kokoro TTS over /ws/voice", source: "backend/evaluation/reports/voice_bench.json", href: blob("backend/evaluation/reports/voice_bench.json") },
  { id: 5, label: "TTS benchmark: time to first byte for Kokoro, Gemini TTS and edge-tts", source: "backend/evaluation/reports/tts_bench.json", href: blob("backend/evaluation/reports/tts_bench.json") },
  { id: 6, label: "Version history and the v4 audit (claimed vs. measured)", source: "VERSION.md", href: blob("VERSION.md") },
  { id: 7, label: "Knowledge base layout, 11 fact tables and the validation gate", source: "backend/data/README.md", href: blob("backend/data/README.md") },
  { id: 8, label: "Security model mapped to the OWASP Top 10 for LLM Applications 2026", source: "docs/DEPLOYMENT.md", href: blob("docs/DEPLOYMENT.md") },
  { id: 9, label: "HCMUT — Ngành và chỉ tiêu tuyển sinh (official source of majors, quotas and cut-offs)", source: "hcmut.edu.vn", href: "https://hcmut.edu.vn/tuyen-sinh/dai-hoc-chinh-quy/nganh-va-chi-tieu" },
  { id: 10, label: "Yan et al., Corrective Retrieval Augmented Generation (CRAG), 2024", source: "arXiv:2401.15884", href: "https://arxiv.org/abs/2401.15884" },
  { id: 11, label: "Cormack, Clarke & Büttcher, Reciprocal Rank Fusion, SIGIR 2009", source: "doi:10.1145/1571941.1572114", href: "https://doi.org/10.1145/1571941.1572114" },
  { id: 12, label: "Robertson & Zaragoza, The Probabilistic Relevance Framework: BM25 and Beyond, 2009", source: "doi:10.1561/1500000019", href: "https://doi.org/10.1561/1500000019" },
  { id: 13, label: "Anthropic, Introducing Contextual Retrieval, 2024", source: "anthropic.com", href: "https://www.anthropic.com/news/contextual-retrieval" },
  { id: 14, label: "Qdrant documentation, Hybrid and multi-stage queries", source: "qdrant.tech", href: "https://qdrant.tech/documentation/concepts/hybrid-queries/" },
  { id: 15, label: "AITeamVN/Vietnamese_Embedding_v2 model card", source: "huggingface.co", href: "https://huggingface.co/AITeamVN/Vietnamese_Embedding_v2" },
  { id: 16, label: "BAAI/bge-reranker-base model card", source: "huggingface.co", href: "https://huggingface.co/BAAI/bge-reranker-base" },
  { id: 17, label: "Kokoro-82M (Apache-2.0) and the Kokoro-Vietnamese fine-tune", source: "huggingface.co · github.com", href: "https://huggingface.co/hexgrad/Kokoro-82M" },
  { id: 18, label: "AssemblyAI documentation, streaming speech-to-text", source: "assemblyai.com", href: "https://www.assemblyai.com/docs" },
  { id: 19, label: "Model Context Protocol specification", source: "modelcontextprotocol.io", href: "https://modelcontextprotocol.io" },
  { id: 20, label: "LangGraph, stateful multi-agent orchestration", source: "github.com/langchain-ai", href: "https://github.com/langchain-ai/langgraph" },
  { id: 21, label: "OWASP Top 10 for LLM Applications 2026 released", source: "helpnetsecurity.com", href: "https://www.helpnetsecurity.com/2026/08/06/owasp-2026-llm-top-10-released/" },
  { id: 22, label: "Wilson, Probable Inference and Statistical Inference, JASA 1927 (score interval)", source: "doi:10.1080/01621459.1927.10502953", href: "https://doi.org/10.1080/01621459.1927.10502953" },
  { id: 23, label: "Google Gemini API, models", source: "ai.google.dev", href: "https://ai.google.dev/gemini-api/docs/models" },
];

export const NAV = [
  { href: "#story", label: "Story" },
  { href: "#product", label: "Product" },
  { href: "#trailer", label: "Trailer" },
  { href: "#metrics", label: "Metrics" },
  { href: "#maker", label: "Maker" },
];

export const MAKER = {
  name: "Long Quan Ton",
  alias: "Bennedict",
  role: "AI Engineer · Bachelor of Artificial Intelligence, UTS × HCMUT",
  bio: [
    "I build agentic systems that have to be right: multi-agent retrieval, speech, and the evaluation that proves them.",
    "BKAi is a solo project. I designed and built every layer, from the crawler and the fact database to the agents, the voice pipeline, this interface and the benchmarks.",
  ],
  credentials: [
    { k: "Study", v: "Bachelor of AI, UTS × HCMUT" },
    { k: "Research", v: "AI Research Assistant, Speech team, AITechLab, HCMUT" },
    { k: "Industry", v: "Backend AI Engineering Intern, FlyRank AI" },
  ],
  awards: [
    { title: "Top 10 Finalist", event: "Vietnam AI Open Hackathon 2026", by: "NVIDIA · Viettel · Sovico" },
    { title: "Silver Tier", event: "AI Riser Vietnam 2026", by: "Google for Developers" },
    { title: "Dean's List 2026", event: "Faculty of Engineering & IT", by: "University of Technology Sydney" },
  ],
  links: [
    { label: "GitHub", href: "https://github.com/BennedictQuanTon" },
    { label: "LinkedIn", href: "https://linkedin.com/in/bennedictquanton" },
    { label: "Email", href: "mailto:tonlongquanvn@gmail.com" },
  ],
};

export type Cert = { title: string; issuer: string; date: string; img: string; verify?: string };

// From the maker's site (MyWebsite/src/data/credentials.ts, projects.ts). Verify links where the issuer provides one.
export const CERTS: Cert[] = [
  { title: "Dean's List 2026", issuer: "UTS · Engineering & IT", date: "2026", img: "uts_deans_list_2026" },
  { title: "Vietnam AI Open Hackathon · Top 10", issuer: "Open Hackathons · OpenACC", date: "Jun 2026", img: "vietnam_ai_open_hackathon" },
  { title: "AI Riser Vietnam 2026 · Silver", issuer: "Google for Developers", date: "2026", img: "ai_riser_vietnam_2026" },
  { title: "Machine Learning Specialization", issuer: "Stanford Online · DeepLearning.AI", date: "Jul 2026", img: "dlai_ml_specialization", verify: "https://learn.deeplearning.ai/certificates/03cbca6d-d44e-401d-ad3e-b6baeb80591d" },
  { title: "Generative AI with Large Language Models", issuer: "DeepLearning.AI · AWS", date: "Jun 2026", img: "dlai_aws_genai_llm", verify: "https://learn.deeplearning.ai/certificates/ded895b0-23ba-4887-b9d4-68239634f73c" },
  { title: "Agentic AI Explained", issuer: "NVIDIA Deep Learning Institute", date: "2026", img: "nvidia_dli_agentic_ai_explained" },
  { title: "AI Agents in LangGraph", issuer: "DeepLearning.AI · LangChain", date: "Jun 2026", img: "dlai_ai_agents_langgraph" },
  { title: "Building Agentic RAG with LlamaIndex", issuer: "DeepLearning.AI · LlamaIndex", date: "Jun 2026", img: "dlai_agentic_rag_llamaindex" },
  { title: "Functions, Tools and Agents with LangChain", issuer: "DeepLearning.AI · LangChain", date: "Jun 2026", img: "dlai_functions_tools_agents_langchain" },
  { title: "AI Fluency: Framework & Foundations", issuer: "Anthropic", date: "2026", img: "anthropic_ai_fluency" },
  { title: "AWS Cloud Practitioner Essentials", issuer: "AWS Training & Certification", date: "Sep 2026", img: "aws_cloud_practitioner_essentials" },
  { title: "Artificial Intelligence Fundamentals", issuer: "IBM SkillsBuild", date: "Jun 2026", img: "ibm_ai_fundamentals", verify: "https://www.credly.com/badges/dda5f3ce-f99d-4794-acdf-b46754207567" },
  { title: "AssemblyAI Voice Agent Hackathon", issuer: "Lablab.ai · NativelyAI", date: "2026", img: "assemblyai_voice_agent_hackathon" },
  { title: "AMD Developer Hackathon: ACT II", issuer: "Lablab.ai · NativelyAI", date: "Jul 2026", img: "amd_developer_hackathon_act2" },
  { title: "Vietnam Youth Start-up Challenge 2026", issuer: "VYSC", date: "2026", img: "vysc_2026_morphysics" },
  { title: "Intermediate Machine Learning", issuer: "Kaggle", date: "Jun 2026", img: "kaggle_intermediate_ml" },
  { title: "Intro to Machine Learning", issuer: "Kaggle", date: "Jun 2026", img: "kaggle_intro_ml" },
];

export const STORY = [
  {
    k: "The problem",
    title: "Admissions data is exact. Chatbots are not.",
    body: "HCMUT admits through 74 admission codes across 9 programs, and cut-offs change by year and method. A general chatbot blends them: an earlier version of this project once answered a 2025 question with 2024 numbers.",
    refs: [9, 6],
  },
  {
    k: "The approach",
    title: "Facts in a database. Agents on top. A verifier at the end.",
    body: "Official pages are crawled and validated into 11 fact tables. A supervisor sends each question to specialist agents in parallel, and a verifier checks every number in the answer against the evidence before it is shown.",
    refs: [7, 20],
  },
  {
    k: "The result",
    title: "The official number, with its source, in about two seconds.",
    body: "8 of 8 real cases and 200 of 200 numbers exactly right on the benchmark; a median answer of 1.8 s, about 15× faster than the previous version.",
    refs: [1, 6],
  },
];

export type Callout = { x: number; y: number; label: string; side?: "left" | "right" };
export type Slide = {
  key: string;
  tab: string;
  title: string;
  body: string;
  image: string;
  alt: string;
  focus: { x: number; y: number; scale: number };
  callouts: Callout[];
  phone?: string;
};

// Callout coordinates are percentages of the 1512 × 982 screen.
export const SLIDES: Slide[] = [
  {
    key: "answer",
    tab: "Grounded answers",
    title: "Ask in plain Vietnamese. Get the number and where it came from.",
    body: "Every figure in an answer carries a citation chip that links to the official page or fact row it came from. Advice is sorted into safe, match and reach against the 2026 cut-offs.",
    image: "/media/ui/answer-body.jpg",
    alt: "BKAi answer with cited sources and recommendation bands",
    focus: { x: 62, y: 45, scale: 1.08 },
    callouts: [
      { x: 41, y: 9, label: "Sources: official pages and fact rows", side: "right" },
      { x: 60, y: 32, label: "Advice sorted against 2026 cut-offs", side: "right" },
      { x: 52, y: 61, label: "“All numbers verified”, with latency", side: "left" },
    ],
  },
  {
    key: "trace",
    tab: "Agent trace",
    title: "Watch a team of agents work, step by step.",
    body: "The supervisor plans, the Data and Counsel agents query the fact database in parallel, the synthesizer writes, and the verifier checks every number. Each step is timed in front of you.",
    image: "/media/ui/answer-trace.jpg",
    alt: "Agent trace: guardrails, supervisor, counsel and data agents, synthesizer, verifier",
    focus: { x: 45, y: 32, scale: 1.1 },
    callouts: [
      { x: 27.5, y: 21, label: "Plans in one call", side: "left" },
      { x: 27.5, y: 32, label: "SQL tools, in parallel", side: "left" },
      { x: 27.5, y: 46, label: "Every number checked", side: "left" },
    ],
  },
  {
    key: "voice",
    tab: "Voice",
    title: "Talk to it. Interrupt it. It keeps up.",
    body: "Streaming speech recognition with HCMUT vocabulary, answers spoken clause by clause by a local Vietnamese voice, and barge-in: start talking and it stops to listen.",
    image: "/media/ui/voice.jpg",
    alt: "BKAi voice conversation page",
    focus: { x: 50, y: 45, scale: 1.06 },
    callouts: [
      { x: 45, y: 24.5, label: "Full-duplex over one WebSocket", side: "right" },
      { x: 52, y: 16, label: "Live transcript and spoken answer", side: "right" },
    ],
  },
  {
    key: "counselor",
    tab: "Counselor",
    title: "Your score, your options.",
    body: "The official 2026 combined-score formula, computed in code, then every major you are interested in compared with its latest cut-off.",
    image: "/media/ui/counselor.jpg",
    alt: "Score calculator and major recommendations",
    focus: { x: 55, y: 60, scale: 1.08 },
    callouts: [
      { x: 30.5, y: 39, label: "Official 2026 formula", side: "left" },
      { x: 79, y: 65.5, label: "Safe · match · reach", side: "left" },
    ],
  },
  {
    key: "observability",
    tab: "Observability",
    title: "Every answer, measured live.",
    body: "Latency percentiles, time to first token, tokens, confidence, the health of 11 components and the knowledge-base inventory, streamed in real time.",
    image: "/media/ui/observability.jpg",
    alt: "Observability dashboard",
    focus: { x: 50, y: 40, scale: 1.05 },
    callouts: [
      { x: 47, y: 10.8, label: "p50 · TTFT · TPOT · tokens", side: "right" },
      { x: 33, y: 45, label: "Health of 11 components", side: "left" },
      { x: 74, y: 40, label: "Knowledge-base inventory", side: "right" },
    ],
  },
  {
    key: "query",
    tab: "Query trace",
    title: "Explain any answer after the fact.",
    body: "Open a question to see its waterfall: guard, supervisor, agents, tools, each Gemini call with TTFT and tokens, the chunks that were retrieved, and the verifier's verdict.",
    image: "/media/ui/trace.jpg",
    alt: "Per-query trace with waterfall and Gemini calls",
    focus: { x: 70, y: 45, scale: 1.08 },
    callouts: [
      { x: 70, y: 19, label: "Latency, TTFT, tokens, confidence", side: "left" },
      { x: 70, y: 44, label: "Waterfall of every step", side: "left" },
      { x: 70, y: 70, label: "Each Gemini call, itemised", side: "left" },
    ],
  },
];

export type Feature = { icon: string; title: string; body: string; metric: string; refs: number[] };

export const FEATURES: Feature[] = [
  { icon: "Network", title: "Multi-agent orchestration", body: "A supervisor plans; Data, Policy and Counsel agents run in parallel; a synthesizer answers with citations.", metric: "0–2 LLM calls per answer", refs: [20, 2] },
  { icon: "Database", title: "Facts in SQL, not in chunks", body: "Cut-offs, quotas, tuition and conversions live in 11 typed tables built from official pages.", metric: "200 / 200", refs: [7, 1] },
  { icon: "ShieldCheck", title: "Deterministic verifier", body: "Every number in an answer must appear in the evidence, or the answer is repaired once.", metric: "200 / 200 factual answers verified", refs: [1] },
  { icon: "Languages", title: "Entity resolver", body: "Codes, nicknames and accent-free spellings (KHMT, CLC, “diem chuan”) resolve to the exact major, program and year.", metric: "275 aliases", refs: [7] },
  { icon: "Search", title: "Hybrid retrieval", body: "Dense Vietnamese embeddings and BM25 fused with reciprocal rank fusion inside Qdrant, then reranked.", metric: "Hit@5 0.955 on 198 queries", refs: [3, 11, 12, 14] },
  { icon: "RotateCcw", title: "Corrective second hop", body: "When the best evidence is weak, the policy agent rewrites the query once instead of guessing.", metric: "≤ 1 retry", refs: [10] },
  { icon: "Layers", title: "Contextual chunks", body: "Child chunks carry their page and section titles; parents keep tables and formulas whole.", metric: "340 chunks", refs: [13, 7] },
  { icon: "Brain", title: "Memory that lasts", body: "A structured student profile keeps scores and interests beyond the message window.", metric: "7 turns later", refs: [1] },
  { icon: "Zap", title: "Entity-guarded cache", body: "Owner-approved answers are reused only for the same major, program, year and method.", metric: "60 ms", refs: [2] },
  { icon: "Mic", title: "Vietnamese voice", body: "AssemblyAI streaming recognition, Kokoro speech, clause-by-clause playback and barge-in.", metric: "CER 1.26% · transcript in 579 ms", refs: [4, 17, 18] },
  { icon: "Calculator", title: "Score calculator", body: "The official 2026 combined-score formula and safe / match / reach bands, computed in code. Default inputs give 75.00 / 100.", metric: "75.00", refs: [9] },
  { icon: "Activity", title: "Observability", body: "Per-query waterfall, TTFT and TPOT for each Gemini call, retrieved chunks, health of 11 components.", metric: "Every request, traced live", refs: [2] },
  { icon: "Plug", title: "MCP server", body: "The same 11 read-only tools, published over the Model Context Protocol for other agents.", metric: "11 tools", refs: [19] },
  { icon: "Lock", title: "Built to deploy", body: "PII redaction, per-IP quotas, WebSocket origin checks and admin tokens, mapped to OWASP LLM 2026.", metric: "OWASP 2026", refs: [8, 21] },
  { icon: "Workflow", title: "Validated data pipeline", body: "Crawl, parse, validate and build: the total quota must equal the official 5,685 or nothing ships.", metric: "Σ 5,685", refs: [7, 9] },
];

// ── Metrics tables ─────────────────────────────────────────────────────────

export type Cell = string | { t: string; kind?: "claimed" | "audit" | "measured" | "best"; ref?: number };

export const VERSION_TABLE: { head: string[]; rows: Cell[][] } = {
  head: ["", "v1", "v2", "v3", "v4", "v5"],
  rows: [
    ["Released", "May 14–20", "Jul 12", "Jul 15", "Jul 16", { t: "Oct 6, 2026", kind: "best" }],
    ["LLM", "Llama 3.2 3B + Qwen 2.5 7B (local)", "Gemini 2.5 Flash-Lite", "Gemini 3.1 Flash-Lite", "Gemini 3.1 Flash-Lite", { t: "Gemini 3.5 Flash-Lite + failover", kind: "best", ref: 23 }],
    ["Orchestration", "Linear graph + loop", "Linear graph + loop", "Linear graph + loop", "Counselor + RAG graphs", { t: "Supervisor → 3 parallel agents → verifier", kind: "best", ref: 20 }],
    ["LLM calls / answer", "4+", "4+", "4+", "3–6", { t: "0–2", kind: "best", ref: 2 }],
    ["Knowledge", "MD + CSV chunks", "+ PDF / DOCX", "115 docs, 150 chunks", "same", { t: "11 SQL tables + 340 chunks", kind: "best", ref: 7 }],
    ["Retrieval", "Chroma + BM25", "Chroma + BM25 + rerank", "same", "same", { t: "Qdrant dense + sparse, RRF, rerank", kind: "best", ref: 14 }],
    ["Embedding", "MiniLM-L12", "MiniLM-L12", "MiniLM-L12", "MiniLM-L12", { t: "Vietnamese_Embedding_v2", kind: "best", ref: 15 }],
    ["Voice", "—", "Whisper + edge-tts", "LiveKit", "LiveKit + Deepgram", { t: "AssemblyAI + Kokoro, barge-in", kind: "best", ref: 4 }],
    ["Cold latency p50", { t: "40–60 s", kind: "claimed" }, { t: "1–3 s", kind: "claimed" }, { t: "9.47 s avg", kind: "claimed" }, { t: "27.3 s", kind: "audit", ref: 6 }, { t: "1.79 s", kind: "measured", ref: 1 }],
    ["Time to first token", "—", "—", "—", { t: "17.7 s", kind: "audit", ref: 6 }, { t: "1.11 s", kind: "measured", ref: 1 }],
    ["Accuracy", { t: "100% (5 cases)", kind: "claimed" }, { t: "“100% grounded”", kind: "claimed" }, { t: "96.8% (250)", kind: "claimed" }, { t: "4 / 5 cases", kind: "audit", ref: 6 }, { t: "8 / 8 · 200 / 200", kind: "measured", ref: 1 }],
    ["Retrieval Hit@1", "—", "—", "—", { t: "0.667 (24 q)", kind: "audit", ref: 6 }, { t: "0.828 (198 q) · Hit@5 0.955", kind: "measured", ref: 3 }],
    ["Evidence in repo", "none", "none", "20-case script", "none", { t: "6 benchmark scripts + JSON reports", kind: "best" }],
  ],
};

export const QUALITY_ROWS: [string, string, string, string, number][] = [
  ["Real admission cases", "8", "8 / 8", "2 easy · 2 medium · 2 hard · 2 out-of-scope", 1],
  ["Numeric exact match", "200", "200 / 200", "150 cut-offs (2024–26, 6 programs) + 50 quotas · Wilson 95% CI 0.981–1.000", 22],
  ["Guardrail probes", "60", "60 / 60 · precision 1.0 · recall 1.0", "31 to refuse (other universities, off-topic, injection) · 29 to answer", 1],
  ["Student conversation", "9 turns", "9 / 9", "greeting → score → advice → tuition → deadline", 1],
  ["Memory depth", "3 probes", "recalled at 0, 3 and 7 distractor turns", "beyond the 12-message window", 1],
  ["Verifier pass rate", "679", "673 / 679 (99.1%) · 200 / 200 in the factual run", "every number in an answer found in the evidence", 2],
  ["Voice answers", "3", "3 / 3 · CER 1.26%", "spoken by a different neural voice", 4],
  ["Data validation", "302 cut-offs", "0 errors · 67 / 67 cross-checked", "Σ 2026 quota = 5,685 (official)", 7],
  ["Before the last fixes", "200 · 60", "199 / 200 · 57 / 60", "found a resolver and a guard gap; both fixed and re-run (reports/history)", 1],
];

export const LATENCY_ROWS: [string, string, string, number][] = [
  ["Answer, real-case benchmark", "p50 1.79 s · p95 5.0 s", "8 cases, live Gemini", 1],
  ["Time to first token", "p50 1.11 s", "8 cases", 1],
  ["Factual questions", "p50 1.89 s · TTFT p50 1.04 s", "200 questions, paced to the free-tier quota", 1],
  ["Answer, steady-state traffic", "p50 1.7 s · p95 4.6 s · p99 6.4 s", "412 requests, warm-up and fallback excluded", 2],
  ["Simple questions (fast path)", "p50 1.66 s · p95 2.7 s", "341 requests, 1 LLM call", 2],
  ["Counseling questions (supervisor)", "p50 3.8 s · p95 6.3 s", "71 requests, 2 LLM calls", 2],
  ["BKAi's own processing", "p50 126 ms", "everything except Gemini time", 2],
  ["Generation speed", "6.9 ms / token · 68 tokens / s", "synthesizer, p50", 2],
  ["Approved-answer cache", "60 ms · 308 ms at 20 concurrent", "0 errors, 0 cross-session leaks", 2],
  ["Voice: speech end → transcript", "p50 579 ms", "AssemblyAI Universal-3.6 Pro", 4],
  ["Voice: speech end → first audio", "p50 2.55 s", "Kokoro, clause streaming", 4],
];

export const RETRIEVAL_ROWS: { cfg: string; h1: string; h5: string; mrr: string; p50: string; best?: boolean; group?: string }[] = [
  { group: "198 queries · every major, 2 phrasings each, plus 50 policy questions", cfg: "MiniLM-L12 hybrid (v4 embedding)", h1: "0.475", h5: "0.924", mrr: "0.674", p50: "31 ms" },
  { cfg: "Vietnamese_Embedding_v2 hybrid", h1: "0.813", h5: "0.975", mrr: "0.886", p50: "38 ms" },
  { cfg: "+ bge-reranker-base (shipped)", h1: "0.828", h5: "0.955", mrr: "0.883", p50: "276 ms", best: true },
  { group: "80 queries · model selection (4 embeddings × 3 modes × 3 rerankers)", cfg: "MiniLM-L12 hybrid (v4 embedding)", h1: "0.425", h5: "0.900", mrr: "0.641", p50: "28 ms" },
  { cfg: "bge-m3 hybrid", h1: "0.800", h5: "0.950", mrr: "0.872", p50: "41 ms" },
  { cfg: "Vietnamese_Embedding_v2 hybrid", h1: "0.825", h5: "0.963", mrr: "0.885", p50: "41 ms" },
  { cfg: "+ bge-reranker-v2-m3", h1: "0.825", h5: "0.988", mrr: "0.901", p50: "1,430 ms" },
  { cfg: "+ Vietnamese_Reranker", h1: "0.787", h5: "0.975", mrr: "0.874", p50: "1,431 ms" },
  { cfg: "+ bge-reranker-base, len 384, 12 candidates (shipped)", h1: "0.875", h5: "0.950", mrr: "0.912", p50: "307 ms" },
];

export const TECHNIQUE_ROWS: [string, string, string, number[]][] = [
  ["Per-request event bus (contextvars)", "global token callback", "0 token leaks under 20 + 6 concurrent sessions", [1]],
  ["Typed SQL fact store + entity resolver", "numbers retrieved as text", "factual 200 / 200; no wrong-year answers", [1, 7]],
  ["Deterministic number verifier", "LLM self-reflection", "673 / 679 answers pass in ~0.5 ms, no extra LLM call", [2]],
  ["Supervisor fast path", "4 chained LLM calls", "1.01 LLM calls per answer; 556 of 792 requests on the fast path", [2]],
  ["Reciprocal rank fusion in Qdrant", "Python-side fusion of two indexes", "hybrid Hit@5 0.975 at 38 ms (198 queries)", [11, 14, 3]],
  ["Vietnamese embedding", "MiniLM-L12", "Hit@1 0.475 → 0.813 on the same 198 queries", [15, 3]],
  ["Tuned cross-encoder rerank", "default length and candidates", "policy Hit@1 0.74 → 0.82; warmed at start-up", [16, 3]],
  ["Corrective hop (CRAG)", "repeated identical search", "reformulates only when evidence is weak", [10]],
  ["Contextual parent / child chunks", "flat 500-token chunks", "tables and formulas stay whole", [13]],
  ["Quota-aware model pool", "fixed RPM lock that raised errors", "785 / 792 answered; 7 polite “busy” replies in a burst over the free-tier quota", [2, 23]],
  ["AssemblyAI streaming + keyterms", "Deepgram / Whisper base", "CER 1.26%, transcript 579 ms after speech", [4, 18]],
  ["Local Kokoro TTS + number normalizer", "edge-tts (cloud)", "first audio byte 591 ms vs 3,821 ms", [5, 17]],
];

export const TESTIMONIALS = [
  { quote: "I asked the same question three ways, with and without accents, and got the same cut-off every time, with the page it came from.", who: "Grade-12 student", where: "Bình Dương" },
  { quote: "The calculator explained exactly how my child's score was built, step by step. I finally understood the new formula.", who: "Parent of an applicant", where: "Ho Chi Minh City" },
  { quote: "Being able to open the trace and see which page each number came from is what makes me comfortable recommending it.", who: "High-school career counselor", where: "Đồng Nai" },
  { quote: "Voice mode felt natural. I could cut in mid-sentence to ask about the dorms and it just switched.", who: "Grade-11 student", where: "Long An" },
];
