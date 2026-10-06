import { AnimatePresence, motion } from "framer-motion";
import { Check, RefreshCw, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AgentTrace } from "../components/AgentTrace";
import { routeLabel } from "../components/Answer";
import { BarList, ChartCard, Histogram, StatTile } from "../components/Charts";
import { adminToken, api, setAdminToken, WS_BASE, type EvalReports, type QuestionRecord, type Stats } from "../lib/api";
import { fadeUp, spring, stagger } from "../lib/motion";
import { cn } from "../lib/utils";

const TABS = ["Tổng quan", "Live console", "Câu hỏi", "Đánh giá", "Tri thức"] as const;
type Tab = (typeof TABS)[number];
const pct = (v: number) => `${(v * 100).toFixed(1)}%`;
const sec = (v: number) => `${(v / 1000).toFixed(2)}s`;

function Table({ head, rows }: { head: string[]; rows: (string | number)[][] }) {
  return (
    <table className="tabular w-full text-body">
      <thead>
        <tr className="border-b border-hairline text-left text-body-sm text-graphite">
          {head.map((h) => <th key={h} className="py-1.5 pr-3 font-normal">{h}</th>)}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} className="border-b border-hairline last:border-0">
            {r.map((c, j) => <td key={j} className="py-1.5 pr-3 text-ink">{c}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function DashboardPage() {
  const [tab, setTab] = useState<Tab>("Tổng quan");
  const [stats, setStats] = useState<Stats | null>(null);
  const [items, setItems] = useState<QuestionRecord[]>([]);
  const [evals, setEvals] = useState<EvalReports | null>(null);
  const [kb, setKb] = useState<Awaited<ReturnType<typeof api.kb>> | null>(null);
  const [token, setToken] = useState(() => adminToken());
  const [loading, setLoading] = useState(false);

  const refresh = async () => {
    setLoading(true);
    const [s, q] = await Promise.allSettled([api.stats(), api.questions(200)]);
    if (s.status === "fulfilled") setStats(s.value);
    if (q.status === "fulfilled") setItems(q.value.items);
    setLoading(false);
  };

  useEffect(() => {
    refresh();
    api.evals().then(setEvals).catch(() => undefined);
    api.kb().then(setKb).catch(() => undefined);
    const id = setInterval(refresh, 15000);
    return () => clearInterval(id);
  }, []);

  const latencies = useMemo(() => items.filter((i) => !i.cached && i.latency_ms > 5).map((i) => i.latency_ms / 1000), [items]);

  return (
    <div className="mx-auto w-full max-w-[1100px] px-4 py-8 sm:px-6">
      <motion.header variants={fadeUp} initial="hidden" animate="show" className="flex flex-wrap items-end gap-3">
        <div>
          <h1 className="text-[22px] font-medium tracking-tight">Dashboard vận hành</h1>
          <p className="text-body text-graphite">Chất lượng, độ trễ, định tuyến agent, kiểm duyệt câu trả lời và benchmark — số liệu thật, không ước lượng.</p>
        </div>
        <button onClick={refresh} className="ml-auto flex items-center gap-1.5 rounded-buttons border border-warm-mist px-3 py-1.5 text-body text-graphite hover:text-ink">
          <RefreshCw size={14} className={cn(loading && "animate-spin")} /> Làm mới
        </button>
      </motion.header>

      <div className="mt-5 flex gap-1 overflow-x-auto border-b border-hairline">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)} className={cn("relative px-3 pb-2.5 pt-1 text-body whitespace-nowrap", tab === t ? "text-ink" : "text-graphite hover:text-ink")}>
            {t}
            {tab === t && <motion.span layoutId="dash-tab" transition={spring} className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-brand" />}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="mt-6">
          {tab === "Tổng quan" && <Overview stats={stats} latencies={latencies} evals={evals} />}
          {tab === "Live console" && <LiveConsole />}
          {tab === "Câu hỏi" && <Questions items={items} token={token} setToken={setToken} onChange={refresh} />}
          {tab === "Đánh giá" && <Benchmarks evals={evals} />}
          {tab === "Tri thức" && <Knowledge kb={kb} />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function Overview({ stats, latencies, evals }: { stats: Stats | null; latencies: number[]; evals: EvalReports | null }) {
  const s = stats;
  const fact = (evals?.e2e?.summary as Record<string, unknown> | undefined)?.factual_exact_match as number | undefined;
  return (
    <motion.div variants={stagger(0.04)} initial="hidden" animate="show" className="space-y-4">
      <motion.div variants={fadeUp} className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label="Câu hỏi đã xử lý" value={s?.total_questions ?? null} format={(v) => Math.round(v).toLocaleString("vi-VN")} hint={`${s?.active_sessions ?? 0} phiên đang mở`} />
        <StatTile label="Độ trễ p50 · p95" value={s ? s.latency_ms.p50 : null} format={(v) => sec(v)} hint={s ? `p95 ${sec(s.latency_ms.p95)} · chữ đầu p50 ${sec(s.ttft_ms.p50)}` : ""} />
        <StatTile label="Verifier đạt" value={s?.verifier_pass_rate ?? null} format={pct} hint="mọi con số khớp evidence" />
        <StatTile label="Độ chính xác số liệu (benchmark)" value={fact ?? null} format={pct} hint="exact match trên bộ factual" />
        <StatTile label="Cache hit" value={s?.cache_hit_rate ?? null} format={pct} hint={s ? `p50 ${s.cache_latency_ms.p50.toFixed(0)} ms khi hit` : ""} />
        <StatTile label="LLM call / câu" value={s?.avg_llm_calls ?? null} format={(v) => v.toFixed(2)} hint="adaptive routing" />
        <StatTile label="Owner đánh giá đúng" value={s?.owner_accuracy ?? null} format={pct} hint={s ? `${s.feedback.correct ?? 0} đúng · ${s.feedback.incorrect ?? 0} sai` : ""} />
        <StatTile label="Lỗi" value={s?.errors ?? null} format={(v) => String(Math.round(v))} hint="500 câu gần nhất" />
      </motion.div>
      <motion.div variants={fadeUp} className="grid gap-4 md:grid-cols-2">
        <ChartCard
          title="Phân bố độ trễ end-to-end"
          subtitle="Số câu hỏi theo khoảng thời gian (giây), không tính cache"
          table={<Table head={["#", "Độ trễ (s)"]} rows={latencies.map((l, i) => [i + 1, l.toFixed(2)])} />}
        >
          <Histogram values={latencies} binSize={1} unit="giây" />
        </ChartCard>
        <ChartCard
          title="Định tuyến"
          subtitle="Số câu theo đường xử lý"
          table={<Table head={["Đường", "Số câu"]} rows={Object.entries(s?.routes ?? {}).map(([k, v]) => [routeLabel(k), v])} />}
        >
          <BarList
            data={Object.entries(s?.routes ?? {}).filter(([k]) => k).map(([k, v]) => ({ label: routeLabel(k), value: v }))}
            format={(v) => String(Math.round(v))}
          />
        </ChartCard>
      </motion.div>
    </motion.div>
  );
}

type LiveEvent = { type: string; agent?: string; tool?: string; detail?: string; result?: string; query?: string; question_id?: string; t_ms?: number; latency_ms?: number; route?: string };

function LiveConsole() {
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [connected, setConnected] = useState(false);
  useEffect(() => {
    const ws = new WebSocket(`${WS_BASE}/ws/dashboard?token=${encodeURIComponent(adminToken())}`);
    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);
    ws.onmessage = (m) => setEvents((e) => [JSON.parse(m.data), ...e].slice(0, 200));
    return () => ws.close();
  }, []);
  return (
    <div className="rounded-cards border border-hairline bg-soft-paper">
      <div className="flex items-center gap-2 border-b border-hairline px-4 py-2.5 text-body text-graphite">
        <span className={cn("h-2 w-2 rounded-full", connected ? "bg-brand" : "bg-ash")} />
        {connected ? "Đang nhận sự kiện agent theo thời gian thực" : "Mất kết nối"} · {events.length} sự kiện
      </div>
      <div className="scrollbar-thin max-h-[560px] overflow-y-auto font-mono text-[12px]">
        <AnimatePresence initial={false}>
          {events.map((e, i) => (
            <motion.div key={`${e.question_id}-${e.t_ms}-${i}`} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="flex gap-3 border-b border-hairline px-4 py-1.5">
              <span className="w-16 shrink-0 text-right tabular text-ash">{e.t_ms !== undefined ? `${e.t_ms.toFixed(0)}ms` : ""}</span>
              <span className="w-24 shrink-0 text-ink">{e.type === "done" ? "✓ done" : e.agent ?? e.type}</span>
              <span className="truncate text-graphite">
                {e.type === "tool" ? `${e.tool} → ${e.result}` : e.type === "done" ? `${routeLabel(e.route ?? "")} · ${sec(e.latency_ms ?? 0)} · “${e.query?.slice(0, 60)}”` : e.detail}
              </span>
            </motion.div>
          ))}
        </AnimatePresence>
        {!events.length && <p className="p-6 text-center font-sans text-body text-graphite">Gửi một câu hỏi ở tab Hỏi đáp để thấy các agent phối hợp tại đây.</p>}
      </div>
    </div>
  );
}

function Questions({ items, token, setToken, onChange }: { items: QuestionRecord[]; token: string; setToken: (t: string) => void; onChange: () => void }) {
  const [open, setOpen] = useState<string | null>(null);
  const act = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
      onChange();
    } catch (e) {
      alert((e as Error).message);
    }
  };
  return (
    <div>
      <div className="mb-3 flex items-center gap-2 text-body-sm text-graphite">
        Admin token
        <input
          type="password"
          value={token}
          onChange={(e) => {
            setToken(e.target.value);
            setAdminToken(e.target.value);
          }}
          className="rounded-buttons border border-warm-mist bg-parchment px-2 py-1 text-body"
          placeholder="nếu máy chủ bật ADMIN_TOKEN"
        />
        <span>Đánh dấu “Đúng” sẽ đưa câu trả lời vào semantic cache.</span>
      </div>
      <div className="divide-y divide-hairline rounded-cards border border-hairline bg-soft-paper">
        {items.map((q) => (
          <div key={q.id} className="px-4 py-3">
            <div className="flex flex-wrap items-start gap-3">
              <button onClick={() => setOpen(open === q.id ? null : q.id)} className="min-w-0 flex-1 text-left">
                <div className="truncate text-body-lg text-ink">{q.query}</div>
                <div className="tabular text-body-sm text-graphite">
                  {new Date(q.ts * 1000).toLocaleString("vi-VN")} · {routeLabel(q.route)} · {sec(q.latency_ms)}
                  {q.verification?.passed === false && " · ⚠ verifier"} {q.user_feedback && ` · người dùng: ${q.user_feedback === "like" ? "👍" : "👎"}`}
                </div>
              </button>
              <span className={cn("rounded-full px-2.5 py-0.5 text-body-sm", q.feedback === "correct" ? "bg-brand text-white" : q.feedback === "incorrect" ? "bg-ink text-parchment" : "border border-warm-mist text-graphite")}>
                {q.feedback === "correct" ? "Đúng" : q.feedback === "incorrect" ? "Sai" : "Chưa duyệt"}
              </span>
              <div className="flex gap-1">
                <button title="Đúng" onClick={() => act(() => api.review(q.id, "correct"))} className="rounded-buttons border border-hairline p-1.5 hover:border-brand"><Check size={14} /></button>
                <button title="Sai" onClick={() => act(() => api.review(q.id, "incorrect"))} className="rounded-buttons border border-hairline p-1.5 hover:border-ink"><X size={14} /></button>
                <button title="Xoá" onClick={() => act(() => api.remove(q.id))} className="rounded-buttons border border-hairline p-1.5 hover:border-ink"><Trash2 size={14} /></button>
              </div>
            </div>
            <AnimatePresence>
              {open === q.id && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                  <div className="mt-3 space-y-3">
                    <p className="whitespace-pre-wrap text-body text-ink">{q.answer}</p>
                    {q.trace && q.trace.length > 0 && <AgentTrace events={q.trace} live={false} defaultOpen />}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
        {!items.length && <p className="p-6 text-center text-body text-graphite">Chưa có câu hỏi nào.</p>}
      </div>
    </div>
  );
}

function Benchmarks({ evals }: { evals: EvalReports | null }) {
  if (!evals) return <p className="text-body text-graphite">Đang tải báo cáo…</p>;
  const chosen = evals.retrieval?.find((r) => r.config.includes("v2 +bge-reranker-base len384"))?.config;
  const retrieval = (evals.retrieval ?? [])
    .filter((r) => !r.config.includes("(no rerank)"))  // same measurement as "vn-emb-v2 hybrid"
    .sort((a, b) => b["hit@1"] - a["hit@1"]);
  const summary = (evals.e2e?.summary ?? {}) as Record<string, unknown>;
  const cases = ((evals.e2e as Record<string, unknown>)?.cases8 ?? []) as { id: string; tier: string; ok: boolean; turns: { q: string; route: string; latency_ms: number; ttft_ms: number }[] }[];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label="8 case thực tế" value={cases.length ? cases.filter((c) => c.ok).length / cases.length : null} format={pct} hint={String(summary.cases8_passed ?? "")} />
        <StatTile label="Factual exact match" value={(summary.factual_exact_match as number) ?? null} format={pct} hint={`Wilson 95% ${JSON.stringify(summary.factual_wilson95 ?? "")}`} />
        <StatTile label="Độ trễ p50 (8 case)" value={(summary.cases8_latency_ms_p50 as number) ?? null} format={sec} hint={`p95 ${sec((summary.cases8_latency_ms_p95 as number) ?? 0)}`} />
        <StatTile label="Chữ đầu tiên p50" value={(summary.cases8_ttft_ms_p50 as number) ?? null} format={sec} hint="time-to-first-token" />
      </div>
      <ChartCard
        title="Retrieval Hit@1 theo cấu hình"
        subtitle="80 câu có nhãn · cấu hình production được tô màu"
        table={<Table head={["Cấu hình", "Hit@1", "Hit@5", "MRR@10", "nDCG@10", "p50 ms"]} rows={retrieval.map((r) => [r.config, r["hit@1"], r["hit@5"], r["mrr@10"], r["ndcg@10"], r.latency_ms_p50])} />}
      >
        <BarList data={retrieval.map((r) => ({ label: prettyConfig(r.config), value: r["hit@1"], note: `${r.config.trim()} · MRR ${r["mrr@10"]} · p50 ${r.latency_ms_p50} ms` }))} highlight={chosen ? prettyConfig(chosen) : undefined} max={1} format={(v) => v.toFixed(3)} />
      </ChartCard>
      <div className="grid gap-4 md:grid-cols-2">
        <ChartCard title="TTS tiếng Việt — thời gian tới âm thanh đầu tiên" subtitle="ms, p50 trên 3 câu mẫu" table={<Table head={["Engine", "TTFB ms", "RTF"]} rows={(evals.tts ?? []).filter((t) => !t.error).map((t) => [t.engine, t.ttfb_ms_p50 ?? "", t.rtf_p50 ?? ""])} />}>
          <BarList data={(evals.tts ?? []).filter((t) => !t.error).map((t) => ({ label: t.engine, value: t.ttfb_ms_p50 ?? 0 }))} highlight={(evals.tts ?? []).find((t) => t.engine.includes("cpu"))?.engine} format={(v) => `${Math.round(v)}`} />
        </ChartCard>
        <ChartCard title="8 case thực tế" subtitle="2 dễ · 2 trung bình · 2 khó · 2 ngoài phạm vi">
          <Table head={["Case", "Mức", "Kết quả", "Độ trễ"]} rows={cases.map((c) => [c.id, c.tier, c.ok ? "✓ đạt" : "✗", c.turns.map((t) => sec(t.latency_ms ?? 0)).join(" · ")])} />
        </ChartCard>
      </div>
    </div>
  );
}

function prettyConfig(c: string): string {
  return c
    .trim()
    .replace(/^v2 /, "vn-emb-v2 ")
    .replace(/\s+/g, " ")
    .replace("hybrid+rerank ", "hybrid + ")
    .replace(/^vn-emb-v2 \+/, "vn-emb-v2 hybrid + ")
    .replace(/len(\d+) cand(\d+)/, "($1 tok, $2 cand)");
}

function Knowledge({ kb }: { kb: Awaited<ReturnType<typeof api.kb>> | null }) {
  if (!kb) return <p className="text-body text-graphite">Đang tải…</p>;
  const m = kb.manifest;
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <ChartCard title="Bảng dữ liệu có cấu trúc" subtitle={`facts.sqlite · kb_version ${m.kb_version} · ${m.built_at ? new Date(m.built_at).toLocaleString("vi-VN") : ""}`} table={<Table head={["Bảng", "Số dòng"]} rows={Object.entries(m.tables ?? {})} />}>
        <BarList data={Object.entries(m.tables ?? {}).map(([k, v]) => ({ label: k, value: v }))} format={(v) => String(Math.round(v))} />
      </ChartCard>
      <ChartCard title="Kho tài liệu (RAG)" subtitle={`Mùa tuyển sinh mới nhất: ${kb.latest_year}`} table={<Table head={["Nhóm", "Tài liệu"]} rows={Object.entries(m.documents ?? {})} />}>
        <BarList data={Object.entries(m.documents ?? {}).map(([k, v]) => ({ label: k, value: v }))} format={(v) => String(Math.round(v))} />
      </ChartCard>
    </div>
  );
}
