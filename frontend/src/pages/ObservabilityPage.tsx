import { AnimatePresence, motion } from "framer-motion";
import { Activity, CircleCheck, CircleDashed, CircleX, Database, FileText, Gauge, RefreshCw, Server, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { routeLabel } from "../components/Answer";
import { BarList, ChartCard, Donut, LineChart, StatTile, Waterfall, type Span } from "../components/Charts";
import { adminToken, api, setAdminToken, Unauthorized, WS_BASE } from "../lib/api";
import { fadeUp, spring, stagger } from "../lib/motion";
import { cn } from "../lib/utils";

/* ── types ─────────────────────────────────────────────── */
type Comp = { status: string; latency_ms?: number; error?: string; [k: string]: unknown };
type SeriesPt = { id: string; ts: number; latency_ms: number; ttft_ms: number | null; tpot_ms: number | null; confidence: number | null; in_tokens: number; out_tokens: number; route: string; category: string; feedback: string; cached: boolean; query: string };
type Overview = {
  generated_at: number;
  health: Record<string, Comp>;
  inventory: { snapshot: Record<string, number | string>; structured_tables: Record<string, number>; documents: Record<string, number>; files_by_type: Record<string, number>; legacy_files: Record<string, number>; kb_version: string; built_at: string };
  analytics: {
    requests: number; latency_ms: Record<string, number | null>; ttft_ms: Record<string, number | null>; tpot_ms: Record<string, number | null>;
    confidence: { mean: number | null; n: number }; tokens: { in: number; out: number };
    models: Record<string, { calls: number; in_tokens: number; out_tokens: number; p50_ms: number | null }>;
    categories: Record<string, number>; routes: Record<string, number>; accuracy: { correct: number; incorrect: number; unreviewed: number };
    verifier_pass_rate: number | null; cache_hit_rate: number; errors: number; stage_p50_ms: Record<string, number | null>; series: SeriesPt[];
  };
  live_clients: number; active_sessions: number;
};
type Ev = { type: string; agent?: string; tool?: string; node?: string; model?: string; status?: string; detail?: string; result?: string; t_ms?: number; ms?: number; ttft_ms?: number; tpot_ms?: number | null; in_tokens?: number; out_tokens?: number; tokens_per_s?: number | null; query?: string; question_id?: string; hits?: Hit[]; timings?: Record<string, number>; args?: Record<string, unknown>; preview?: Record<string, unknown>[]; latency_ms?: number; route?: string; category?: string; confidence?: number | null; attempt?: number; error?: string };
type Hit = { rank: number; doc_id: string; title: string; section: string; score: number; fused_rank: number; source_type: string; chars: number; preview: string };
type Detail = Record<string, unknown> & { id: string; query: string; answer: string; trace: Ev[]; route: string; latency_ms: number; ttft_ms: number | null; tpot_ms: number | null; tokens_per_s: number | null; in_tokens: number; out_tokens: number; llm_ms: number; retrieval_ms: number; confidence: number | null; category: string; plan?: Record<string, unknown>; entities?: Record<string, unknown>; verification?: Record<string, unknown>; sources?: { id: number; title: string; url: string; kind: string }[]; ts: number; channel: string };

const ms = (v?: number | null) => (v === null || v === undefined ? "—" : v >= 1000 ? `${(v / 1000).toFixed(2)} s` : `${Math.round(v)} ms`);
const num = (v: number) => Math.round(v).toLocaleString("vi-VN");
const CAT_LABEL: Record<string, string> = {
  diem_chuan: "Điểm chuẩn", chi_tieu: "Chỉ tiêu", hoc_phi: "Học phí", phuong_thuc: "Phương thức", tieng_anh: "Tiếng Anh",
  tu_van: "Tư vấn", nganh_hoc: "Ngành học", nhap_hoc: "Nhập học", doi_song: "Đời sống SV", ngoai_pham_vi: "Ngoài phạm vi", chao_hoi: "Chào hỏi", khac: "Khác",
};
const COMP_LABEL: Record<string, string> = {
  api: "API (FastAPI)", redis: "Redis", qdrant: "Qdrant", facts_db: "facts.sqlite", gemini: "Gemini pool", embedder: "Embedding model",
  reranker: "Reranker", tts_kokoro: "TTS · Kokoro", stt_assemblyai: "STT · AssemblyAI", stt_whisper: "STT · Whisper", livekit: "LiveKit",
};

function StatusIcon({ status }: { status: string }) {
  if (status === "healthy" || status === "configured") return <CircleCheck size={15} className="text-brand" aria-label="healthy" />;
  if (status === "down") return <CircleX size={15} className="text-ink" aria-label="down" />;
  return <CircleDashed size={15} className="text-ash" aria-label={status} />;
}

/* ── live feed: group streaming events by question ── */
type LiveQ = { id: string; query: string; started: number; events: Ev[]; done?: Ev };

export default function ObservabilityPage({ onClose }: { onClose?: () => void }) {
  const [ov, setOv] = useState<Overview | null>(null);
  const [live, setLive] = useState<LiveQ[]>([]);
  const [connected, setConnected] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [limit, setLimit] = useState(200);
  const [loading, setLoading] = useState(false);
  const [needToken, setNeedToken] = useState(false);
  const [tokenDraft, setTokenDraft] = useState("");
  const [wsKey, setWsKey] = useState(0);
  const refreshTimer = useRef<number | undefined>(undefined);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setOv((await api.observability(limit)) as Overview);
      setNeedToken(false);
    } catch (e) {
      if (e instanceof Unauthorized) setNeedToken(true);
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    load();
    const id = setInterval(load, 10000);
    return () => clearInterval(id);
  }, [load]);

  useEffect(() => {
    const ws = new WebSocket(`${WS_BASE}/ws/dashboard?token=${encodeURIComponent(adminToken())}`);
    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);
    ws.onmessage = (m) => {
      const ev = JSON.parse(m.data) as Ev;
      if (!ev.question_id) return;
      setLive((prev) => {
        const idx = prev.findIndex((q) => q.id === ev.question_id);
        const q: LiveQ = idx >= 0 ? { ...prev[idx], events: [...prev[idx].events, ev] } : { id: ev.question_id!, query: ev.query || "", started: Date.now(), events: [ev] };
        if (ev.type === "done" || ev.type === "error") q.done = ev;
        const next = idx >= 0 ? prev.map((x, i) => (i === idx ? q : x)) : [q, ...prev];
        return next.slice(0, 30);
      });
      if (ev.type === "done") {
        window.clearTimeout(refreshTimer.current);
        refreshTimer.current = window.setTimeout(load, 600); // aggregates follow the live feed
      }
    };
    return () => ws.close();
  }, [load, wsKey]);

  const a = ov?.analytics;
  if (needToken) {
    return (
      <div className="mx-auto max-w-md px-6 py-16 text-center">
        <Activity size={22} className="mx-auto text-ink" />
        <h1 className="mt-3 text-[20px] font-medium">Observability yêu cầu admin token</h1>
        <p className="mt-1 text-body text-graphite">Máy chủ đang bật ADMIN_TOKEN — dữ liệu vận hành chỉ dành cho người quản trị.</p>
        <form className="mt-5 flex gap-2" onSubmit={(e) => { e.preventDefault(); setAdminToken(tokenDraft); setWsKey((k) => k + 1); load(); }}>
          <input type="password" value={tokenDraft} onChange={(e) => setTokenDraft(e.target.value)} placeholder="ADMIN_TOKEN" className="flex-1 rounded-inputs border border-warm-mist bg-parchment px-3 py-2 text-body" />
          <button className="rounded-inputs bg-ink px-4 py-2 text-body text-parchment">Mở</button>
        </form>
        {onClose && <button onClick={onClose} className="mt-4 text-body-sm text-graphite underline">Đóng</button>}
      </div>
    );
  }
  const series = a?.series ?? [];
  const acc = a?.accuracy ?? { correct: 0, incorrect: 0, unreviewed: 0 };
  const reviewed = acc.correct + acc.incorrect;

  return (
    <div className="mx-auto w-full max-w-[1280px] px-4 py-6 sm:px-6">
      <motion.header variants={fadeUp} initial="hidden" animate="show" className="flex flex-wrap items-center gap-3">
        <div className="grid h-9 w-9 place-items-center rounded-inputs bg-ink text-parchment"><Activity size={18} /></div>
        <div>
          <h1 className="text-[22px] font-medium tracking-tight">Observability</h1>
          <p className="text-body-sm text-graphite">Từng câu hỏi được truy vết end-to-end: agent · tool · truy hồi · suy luận Gemini · token · độ tin cậy.</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="flex items-center gap-1.5 rounded-full border border-hairline px-2.5 py-1 text-body-sm text-graphite">
            <motion.span className={cn("h-2 w-2 rounded-full", connected ? "bg-brand" : "bg-ash")} animate={connected ? { opacity: [1, 0.35, 1] } : {}} transition={{ duration: 1.6, repeat: Infinity }} />
            {connected ? "Live" : "Offline"}
          </span>
          <select value={limit} onChange={(e) => setLimit(Number(e.target.value))} className="rounded-buttons border border-warm-mist bg-parchment px-2 py-1 text-body-sm" aria-label="Phạm vi dữ liệu">
            <option value={50}>50 câu gần nhất</option>
            <option value={200}>200 câu gần nhất</option>
            <option value={500}>500 câu gần nhất</option>
          </select>
          <button onClick={load} className="rounded-buttons border border-warm-mist p-1.5 text-graphite hover:text-ink" aria-label="Làm mới"><RefreshCw size={14} className={cn(loading && "animate-spin")} /></button>
          {onClose && <button onClick={onClose} className="rounded-buttons border border-warm-mist p-1.5 text-graphite hover:text-ink" aria-label="Đóng"><X size={16} /></button>}
        </div>
      </motion.header>

      {/* KPI row */}
      <motion.div variants={stagger(0.03)} initial="hidden" animate="show" className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
        {[
          ["Requests", a?.requests ?? null, num, `${ov?.active_sessions ?? 0} phiên · ${ov?.live_clients ?? 0} viewer`],
          ["Latency p50", a?.latency_ms.p50 ?? null, ms, `p95 ${ms(a?.latency_ms.p95)} · p99 ${ms(a?.latency_ms.p99)}`],
          ["TTFT p50", a?.ttft_ms.p50 ?? null, ms, `p95 ${ms(a?.ttft_ms.p95)}`],
          ["TPOT p50", a?.tpot_ms.p50 ?? null, (v: number) => `${v.toFixed(1)} ms`, "ms / output token"],
          ["Tokens in · out", a ? a.tokens.in + a.tokens.out : null, num, a ? `${num(a.tokens.in)} in · ${num(a.tokens.out)} out` : ""],
          ["Confidence TB", a?.confidence.mean ?? null, (v: number) => v.toFixed(2), `${a?.confidence.n ?? 0} câu có grounding`],
          ["Verifier pass", a?.verifier_pass_rate ?? null, (v: number) => `${(v * 100).toFixed(1)}%`, "số liệu khớp evidence"],
          ["Cache hit", a?.cache_hit_rate ?? null, (v: number) => `${(v * 100).toFixed(1)}%`, `${a?.errors ?? 0} lỗi`],
        ].map(([label, value, fmt, hint]) => (
          <motion.div key={label as string} variants={fadeUp}>
            <StatTile label={label as string} value={value as number | null} format={fmt as (v: number) => string} hint={hint as string} />
          </motion.div>
        ))}
      </motion.div>

      {/* health + inventory */}
      <div className="mt-4 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <ChartCard title="Sức khoẻ hệ thống" subtitle="Kiểm tra trực tiếp mỗi 10 giây">
          <div className="grid gap-2 sm:grid-cols-2">
            {Object.entries(ov?.health ?? {}).map(([k, c]) => (
              <div key={k} className="flex items-start gap-2 rounded-inputs border border-hairline px-3 py-2">
                <StatusIcon status={c.status} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="text-body text-ink">{COMP_LABEL[k] ?? k}</span>
                    <span className="text-caption text-graphite">{c.status.replace("_", " ")}</span>
                    {c.latency_ms !== undefined && <span className="tabular ml-auto text-caption text-ash">{c.latency_ms} ms</span>}
                  </div>
                  <div className="truncate text-caption text-graphite">{componentDetail(k, c)}</div>
                </div>
              </div>
            ))}
          </div>
        </ChartCard>
        <ChartCard title="Dữ liệu tri thức" subtitle={`kb_version ${ov?.inventory.kb_version ?? "—"} · build ${ov?.inventory.built_at ? new Date(ov.inventory.built_at).toLocaleString("vi-VN") : "—"}`}>
          <div className="grid grid-cols-3 gap-2">
            {[
              ["Trang chính thức", ov?.inventory.snapshot.pages, Server],
              ["Bảng HTML gốc", ov?.inventory.snapshot.html_tables, Database],
              ["Bảng structured", Object.keys(ov?.inventory.structured_tables ?? {}).length, Database],
              ["Dòng dữ liệu", Object.values(ov?.inventory.structured_tables ?? {}).reduce((s, v) => s + v, 0), Database],
              ["Tài liệu .md", Object.values(ov?.inventory.documents ?? {}).reduce((s, v) => s + v, 0), FileText],
              ["Chunks (Qdrant)", (ov?.health.qdrant?.points as number) ?? null, Gauge],
            ].map(([l, v, Icon]) => {
              const I = Icon as typeof Server;
              return (
                <div key={l as string} className="rounded-inputs border border-hairline px-3 py-2">
                  <div className="flex items-center gap-1 text-caption text-graphite"><I size={12} />{l as string}</div>
                  <div className="tabular text-[20px] font-medium text-ink">{(v as number | string | null | undefined) ?? "—"}</div>
                </div>
              );
            })}
          </div>
          <div className="mt-3 text-body-sm text-graphite">
            Theo loại file: {Object.entries(ov?.inventory.files_by_type ?? {}).map(([k, v]) => `${v} ${k}`).join(" · ") || "—"}
            <br />Tài liệu: {Object.entries(ov?.inventory.documents ?? {}).map(([k, v]) => `${k} ${v}`).join(" · ")} · legacy v4: {Object.entries(ov?.inventory.legacy_files ?? {}).map(([k, v]) => `${v} ${k}`).join(" · ")} · snapshot {String(ov?.inventory.snapshot.date ?? "—")}
          </div>
        </ChartCard>
      </div>

      {/* trends */}
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <ChartCard title="Latency end-to-end" subtitle="mỗi điểm = một câu hỏi (không tính cache, guardrail)">
          <LineChart points={series.filter((p) => !p.cached && p.route !== "guardrail").map((p) => ({ x: p.ts, y: p.latency_ms, label: p.query }))} format={(v) => `${(v / 1000).toFixed(1)}s`} />
        </ChartCard>
        <ChartCard title="Time to first token" subtitle="từ lúc nhận câu hỏi tới token đầu tiên">
          <LineChart points={series.filter((p) => !p.cached && p.route !== "guardrail").map((p) => ({ x: p.ts, y: p.ttft_ms, label: p.query }))} format={(v) => `${(v / 1000).toFixed(1)}s`} />
        </ChartCard>
        <ChartCard title="Confidence" subtitle="0.6 × grounding + 0.4 × verifier">
          <LineChart points={series.map((p) => ({ x: p.ts, y: p.confidence, label: p.query }))} format={(v) => v.toFixed(2)} yMax={1} />
        </ChartCard>
        <ChartCard title="TPOT (Synthesizer)" subtitle="ms mỗi token sinh ra · Gemini 3.5 Flash-Lite">
          <LineChart points={series.map((p) => ({ x: p.ts, y: p.tpot_ms, label: p.query }))} format={(v) => `${v.toFixed(1)}ms`} />
        </ChartCard>
        <ChartCard title="Tokens / câu hỏi" subtitle="input + output trên mọi lần gọi LLM">
          <LineChart points={series.filter((p) => p.in_tokens + p.out_tokens > 0).map((p) => ({ x: p.ts, y: p.in_tokens + p.out_tokens, label: p.query }))} format={(v) => num(v)} />
        </ChartCard>
        <ChartCard title="Độ chính xác (owner review)" subtitle={reviewed ? `${reviewed} câu đã duyệt` : "duyệt ở Dashboard → Câu hỏi"}>
          <Donut
            center={reviewed ? `${Math.round((acc.correct / reviewed) * 100)}%` : "—"}
            slices={[
              { label: "Đúng", value: acc.correct, color: "var(--color-chart)", icon: "✓" },
              { label: "Sai", value: acc.incorrect, color: "var(--color-ink)", icon: "✕" },
              { label: "Chưa duyệt", value: acc.unreviewed, color: "var(--color-chart-muted)", icon: "○" },
            ]}
          />
        </ChartCard>
      </div>

      {/* distributions */}
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <ChartCard title="Loại câu hỏi" subtitle="phân loại rule-based, 0 LLM">
          <BarList data={Object.entries(a?.categories ?? {}).map(([k, v]) => ({ label: k, value: v }))} format={(v) => String(Math.round(v))} />
        </ChartCard>
        <ChartCard title="Thời gian p50 theo bước" subtitle="ms · trên các câu đi qua agent graph">
          <BarList data={Object.entries(a?.stage_p50_ms ?? {}).filter(([, v]) => v !== null).sort((x, y) => (y[1] ?? 0) - (x[1] ?? 0)).map(([k, v]) => ({ label: k, value: v as number }))} format={(v) => `${Math.round(v)}`} />
        </ChartCard>
        <ChartCard title="Mô hình & token" subtitle="theo model thực sự trả lời (sau failover)">
          <table className="tabular w-full text-body-sm">
            <thead><tr className="border-b border-hairline text-left text-graphite"><th className="py-1 font-normal">Model</th><th className="font-normal text-right">Calls</th><th className="font-normal text-right">In</th><th className="font-normal text-right">Out</th><th className="font-normal text-right">p50</th></tr></thead>
            <tbody>
              {Object.entries(a?.models ?? {}).map(([m, v]) => (
                <tr key={m} className="border-b border-hairline last:border-0"><td className="py-1.5 text-ink">{m}</td><td className="text-right">{v.calls}</td><td className="text-right">{num(v.in_tokens)}</td><td className="text-right">{num(v.out_tokens)}</td><td className="text-right">{ms(v.p50_ms)}</td></tr>
              ))}
            </tbody>
          </table>
          <div className="mt-3 text-body-sm text-graphite">Định tuyến: {Object.entries(a?.routes ?? {}).map(([k, v]) => `${routeLabel(k)} ${v}`).join(" · ")}</div>
        </ChartCard>
      </div>

      {/* live feed + history */}
      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1fr]">
        <ChartCard title="Luồng trực tiếp" subtitle="sự kiện agent · tool · LLM · truy hồi của mọi phiên">
          <div className="scrollbar-thin max-h-[420px] space-y-2 overflow-y-auto">
            <AnimatePresence initial={false}>
              {live.map((q) => (
                <motion.button key={q.id} layout initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} transition={spring}
                  onClick={() => q.done && setSelected(q.id)} className="block w-full rounded-inputs border border-hairline px-3 py-2 text-left hover:border-warm-mist">
                  <div className="flex items-center gap-2">
                    {q.done ? <CircleCheck size={14} className="text-brand" /> : <motion.span className="h-2 w-2 rounded-full bg-brand" animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1, repeat: Infinity }} />}
                    <span className="truncate text-body text-ink">{q.query}</span>
                    {q.done && <span className="tabular ml-auto shrink-0 text-body-sm text-graphite">{ms(q.done.latency_ms)}</span>}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {q.events.filter((e) => e.type === "llm" || e.type === "retrieval" || e.type === "tool" || (e.type === "agent" && e.agent)).slice(-9).map((e, i) => (
                      <span key={i} className="rounded-full bg-parchment px-2 py-0.5 font-mono text-[11px] text-graphite">
                        {e.type === "llm" ? `llm ${e.node} ${ms(e.ms)} · ${e.out_tokens}tok` : e.type === "retrieval" ? `retrieval ${e.hits?.length} chunks ${ms(e.ms)}` : e.type === "tool" ? `${e.tool} ${ms(e.ms)}` : `${e.agent} ${e.status}`}
                      </span>
                    ))}
                  </div>
                </motion.button>
              ))}
            </AnimatePresence>
            {!live.length && <p className="py-8 text-center text-body-sm text-graphite">Đang chờ câu hỏi mới… (đặt câu hỏi ở tab Hỏi đáp)</p>}
          </div>
        </ChartCard>
        <ChartCard title="Lịch sử truy vết" subtitle="bấm để xem toàn bộ quá trình của một câu hỏi">
          <div className="scrollbar-thin max-h-[420px] divide-y divide-hairline overflow-y-auto">
            {[...series].reverse().map((p) => (
              <button key={p.id} onClick={() => setSelected(p.id)} className="grid w-full grid-cols-[1fr_auto] gap-x-3 px-1 py-2 text-left hover:bg-parchment">
                <span className="truncate text-body text-ink">{p.query}</span>
                <span className="tabular text-body-sm text-graphite">{ms(p.latency_ms)}</span>
                <span className="text-caption text-ash">{CAT_LABEL[p.category] ?? p.category} · {routeLabel(p.route)}{p.confidence !== null ? ` · conf ${p.confidence.toFixed(2)}` : ""}</span>
                <span className="tabular text-caption text-ash">{new Date(p.ts * 1000).toLocaleTimeString("vi-VN")}</span>
              </button>
            ))}
          </div>
        </ChartCard>
      </div>

      <AnimatePresence>{selected && <QueryDetail id={selected} onClose={() => setSelected(null)} />}</AnimatePresence>
    </div>
  );
}

function componentDetail(k: string, c: Comp): string {
  if (c.error) return String(c.error);
  if (k === "qdrant") return `${c.mode} · ${c.points} chunks · cache ${c.cache_points}`;
  if (k === "redis") return `${c.keys} keys · ${c.used_memory}`;
  if (k === "facts_db") return `${c.majors} ngành · ${c.scores} điểm chuẩn`;
  if (k === "gemini") return ((c.pool as { model: string; calls_last_min: number; rpm_limit: number; cooldown_s: number }[]) ?? []).map((p) => `${p.model.replace("gemini-", "")} ${p.calls_last_min}/${p.rpm_limit}rpm${p.cooldown_s ? ` ⏸${p.cooldown_s}s` : ""}`).join(" · ");
  if (k === "api") return `v${c.version} · uptime ${Math.round(Number(c.uptime_s) / 60)} phút`;
  if (k === "stt_assemblyai") return `${c.model} · ${c.sessions} phiên · ${c.turns} lượt${c.last_error ? ` · lỗi: ${c.last_error}` : ""}`;
  return String(c.model ?? c.provider ?? "");
}

/* ── one request, end to end ─────────────────────────── */
function buildSpans(trace: Ev[]): Span[] {
  const spans: Span[] = [];
  const running: Record<string, number> = {};
  for (const e of trace) {
    const t = e.t_ms ?? 0;
    if (e.type === "agent") {
      if (e.status === "running") running[e.agent!] = t;
      if (e.status === "done") spans.push({ label: e.agent!, sub: (e.detail ?? "").slice(0, 60), start: running[e.agent!] ?? t, end: t, kind: "agent" });
    } else if (e.type === "llm") {
      const start = t - (e.ms ?? 0);
      spans.push({ label: `Gemini · ${e.node}`, sub: `${e.model} · ${e.in_tokens}→${e.out_tokens} tok`, start, end: t, mark: e.ttft_ms ? start + e.ttft_ms : undefined, kind: "llm" });
    } else if (e.type === "retrieval") {
      spans.push({ label: "hybrid search + rerank", sub: (e.query ?? "").slice(0, 50), start: t - (e.ms ?? 0), end: t, kind: "retrieval" });
    } else if (e.type === "tool" && e.tool !== "search_documents") {
      spans.push({ label: `tool · ${e.tool}`, start: t - (e.ms ?? 0), end: t, kind: "tool" });
    }
  }
  return spans.sort((x, y) => x.start - y.start);
}

function QueryDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const [d, setD] = useState<Detail | null>(null);
  useEffect(() => {
    api.observabilityQuery(id).then((x) => setD(x as Detail)).catch(() => undefined);
  }, [id]);
  const spans = useMemo(() => (d ? buildSpans(d.trace || []) : []), [d]);
  const llm = (d?.trace || []).filter((e) => e.type === "llm");
  const retrievals = (d?.trace || []).filter((e) => e.type === "retrieval");
  const tools = (d?.trace || []).filter((e) => e.type === "tool" && e.tool !== "search_documents");
  return (
    <motion.div className="fixed inset-0 z-50 flex justify-end bg-ink/20" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.aside initial={{ x: 40, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 40, opacity: 0 }} transition={spring}
        onClick={(e) => e.stopPropagation()} className="scrollbar-thin h-full w-full max-w-[860px] overflow-y-auto border-l border-hairline bg-parchment p-6">
        <div className="flex items-start gap-3">
          <div className="min-w-0">
            <div className="text-caption text-graphite">{d ? `${new Date(d.ts * 1000).toLocaleString("vi-VN")} · ${d.channel} · ${CAT_LABEL[d.category] ?? d.category} · ${routeLabel(d.route)}` : id}</div>
            <h2 className="text-[20px] font-medium leading-snug text-ink">{d?.query ?? "…"}</h2>
            {d?.plan?.resolved_query !== undefined && d.plan.resolved_query !== d.query && <div className="text-body-sm text-graphite">resolved: {String(d.plan.resolved_query)}</div>}
          </div>
          <button onClick={onClose} className="ml-auto rounded-buttons border border-warm-mist p-1.5 text-graphite" aria-label="Đóng"><X size={16} /></button>
        </div>
        {d && (
          <div className="mt-5 space-y-5">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[["Latency", ms(d.latency_ms)], ["TTFT", ms(d.ttft_ms)], ["TPOT", d.tpot_ms ? `${d.tpot_ms} ms/tok` : "—"], ["Throughput", d.tokens_per_s ? `${d.tokens_per_s} tok/s` : "—"],
                ["Tokens in → out", `${d.in_tokens} → ${d.out_tokens}`], ["LLM time", ms(d.llm_ms)], ["Retrieval time", ms(d.retrieval_ms)], ["Confidence", d.confidence !== null ? d.confidence.toFixed(2) : "n/a"]].map(([l, v]) => (
                <div key={l} className="rounded-inputs border border-hairline bg-soft-paper px-3 py-2"><div className="text-caption text-graphite">{l}</div><div className="tabular text-body-lg text-ink">{v}</div></div>
              ))}
            </div>
            <section>
              <h3 className="mb-2 text-body text-ink">Timeline (waterfall) — vạch đen = token đầu tiên</h3>
              <Waterfall spans={spans} total={d.latency_ms} />
            </section>
            {llm.length > 0 && (
              <section>
                <h3 className="mb-2 text-body text-ink">Suy luận Gemini</h3>
                <table className="tabular w-full text-body-sm">
                  <thead><tr className="border-b border-hairline text-left text-graphite">{["Node", "Model", "TTFT", "Tổng", "TPOT", "tok/s", "In", "Out"].map((h) => <th key={h} className="py-1 font-normal">{h}</th>)}</tr></thead>
                  <tbody>{llm.map((e, i) => (<tr key={i} className="border-b border-hairline last:border-0 text-ink"><td className="py-1.5">{e.node}{e.attempt && e.attempt > 1 ? ` (lần ${e.attempt})` : ""}</td><td>{e.model}{e.error ? " ⚠" : ""}</td><td>{ms(e.ttft_ms)}</td><td>{ms(e.ms)}</td><td>{e.tpot_ms ?? "—"}</td><td>{e.tokens_per_s ?? "—"}</td><td>{e.in_tokens}</td><td>{e.out_tokens}</td></tr>))}</tbody>
                </table>
              </section>
            )}
            {retrievals.map((r, i) => (
              <section key={i}>
                <h3 className="mb-1 text-body text-ink">Truy hồi: “{r.query}”</h3>
                <div className="mb-2 text-body-sm text-graphite tabular">embed {ms(r.timings?.embed_ms)} · Qdrant (dense + BM25 + RRF) {ms(r.timings?.qdrant_ms)} · rerank {ms(r.timings?.rerank_ms)} · tổng {ms(r.ms)}</div>
                <div className="divide-y divide-hairline rounded-inputs border border-hairline bg-soft-paper">
                  {(r.hits ?? []).map((h) => (
                    <div key={h.rank} className="grid grid-cols-[28px_1fr_70px] gap-2 px-3 py-2 text-body-sm">
                      <span className="tabular text-graphite">#{h.rank}</span>
                      <span className="min-w-0"><span className="text-ink">{h.title}</span><span className="text-ash"> › {h.section}</span><span className="block truncate text-caption text-graphite">{h.preview}</span><span className="text-caption text-ash">{h.source_type} · fused rank {h.fused_rank} · {h.chars} ký tự</span></span>
                      <span className="tabular text-right text-ink">{h.score.toFixed(3)}</span>
                    </div>
                  ))}
                </div>
              </section>
            ))}
            {tools.length > 0 && (
              <section>
                <h3 className="mb-2 text-body text-ink">Tool calls (SQL & tính toán)</h3>
                <div className="space-y-2">
                  {tools.map((t, i) => (
                    <div key={i} className="rounded-inputs border border-hairline bg-soft-paper px-3 py-2 text-body-sm">
                      <div className="flex gap-2"><span className="font-mono text-ink">{t.agent}.{t.tool}</span><span className="truncate text-ash">{JSON.stringify(t.args)}</span><span className="tabular ml-auto text-graphite">{t.result} · {ms(t.ms)}</span></div>
                      {t.preview && t.preview.length > 0 && <div className="mt-1 font-mono text-[11px] leading-relaxed text-graphite">{t.preview.slice(0, 4).map((p, j) => <div key={j} className="truncate">{Object.entries(p).map(([k, v]) => `${k}=${v}`).join("  ")}</div>)}</div>}
                    </div>
                  ))}
                </div>
              </section>
            )}
            <section className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-inputs border border-hairline bg-soft-paper px-3 py-2 text-body-sm"><div className="text-graphite">Plan</div><pre className="whitespace-pre-wrap font-mono text-[11px] text-ink">{JSON.stringify(d.plan, null, 1)}</pre></div>
              <div className="rounded-inputs border border-hairline bg-soft-paper px-3 py-2 text-body-sm"><div className="text-graphite">Verifier & entities</div><pre className="whitespace-pre-wrap font-mono text-[11px] text-ink">{JSON.stringify({ verification: d.verification, entities: d.entities }, null, 1)}</pre></div>
            </section>
            <section>
              <h3 className="mb-2 text-body text-ink">Câu trả lời</h3>
              <p className="whitespace-pre-wrap rounded-inputs border border-hairline bg-soft-paper p-3 text-body text-ink">{d.answer}</p>
            </section>
          </div>
        )}
      </motion.aside>
    </motion.div>
  );
}
