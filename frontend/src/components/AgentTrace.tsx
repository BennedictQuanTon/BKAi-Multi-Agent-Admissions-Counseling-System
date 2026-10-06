import { AnimatePresence, motion } from "framer-motion";
import { BookOpenText, Bot, Calculator, ChevronDown, Database, Feather, ShieldCheck, Sparkles, Zap } from "lucide-react";
import { useMemo, useState } from "react";
import type { TraceEvent } from "../lib/api";
import { ease, spring } from "../lib/motion";
import { cn } from "../lib/utils";

const AGENTS: Record<string, { label: string; role: string; icon: typeof Bot }> = {
  guard: { label: "Guardrails", role: "lọc phạm vi & prompt-injection", icon: ShieldCheck },
  cache: { label: "Semantic cache", role: "khoá theo thực thể", icon: Zap },
  supervisor: { label: "Supervisor", role: "lập kế hoạch & điều phối", icon: Sparkles },
  data: { label: "Data agent", role: "SQL trên dữ liệu chính thức", icon: Database },
  policy: { label: "Policy agent", role: "Hybrid RAG + rerank", icon: BookOpenText },
  counsel: { label: "Counsel agent", role: "tính điểm & đối chiếu", icon: Calculator },
  synthesizer: { label: "Synthesizer", role: "viết câu trả lời có trích dẫn", icon: Feather },
  verifier: { label: "Verifier", role: "kiểm chứng từng con số", icon: ShieldCheck },
};

type Step = { agent: string; status: string; detail: string; start: number; end?: number; tools: TraceEvent[] };

function buildSteps(events: TraceEvent[]): Step[] {
  const steps: Step[] = [];
  const byAgent = new Map<string, Step>();
  for (const e of events) {
    let s = byAgent.get(e.agent);
    if (!s) {
      s = { agent: e.agent, status: "running", detail: "", start: e.t_ms, tools: [] };
      byAgent.set(e.agent, s);
      steps.push(s);
    }
    if (e.type === "tool") s.tools.push(e);
    else {
      s.status = e.status || s.status;
      if (e.detail) s.detail = e.detail;
      if (e.status === "done") s.end = e.t_ms;
    }
  }
  return steps;
}

function Check() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden>
      <motion.path
        d="M3.5 8.5l3 3 6-7"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.35, ease }}
      />
    </svg>
  );
}

export function AgentTrace({ events, live, defaultOpen = false }: { events: TraceEvent[]; live: boolean; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const steps = useMemo(() => buildSteps(events), [events]);
  const tools = steps.reduce((n, s) => n + s.tools.length, 0);
  const agents = steps.filter((s) => ["data", "policy", "counsel"].includes(s.agent)).length;
  const last = events.length ? events[events.length - 1].t_ms : 0;
  if (!steps.length) return null;

  return (
    <div className="rounded-cards border border-hairline bg-soft-paper">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-body text-graphite">
        <span className="relative grid h-5 w-5 place-items-center">
          {live ? (
            <motion.span className="h-2 w-2 rounded-full bg-brand" animate={{ scale: [1, 1.5, 1], opacity: [1, 0.5, 1] }} transition={{ duration: 1.2, repeat: Infinity }} />
          ) : (
            <span className="text-brand"><Check /></span>
          )}
        </span>
        <span className="text-ink">{live ? "Các tác tử đang làm việc" : "Cách BKAi tìm câu trả lời"}</span>
        <span className="tabular">· {agents} tác tử chuyên trách · {tools} lần gọi công cụ · {(last / 1000).toFixed(1)}s</span>
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={spring} className="ml-auto">
          <ChevronDown size={16} />
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {(open || live) && (
          <motion.ol
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease }}
            className="overflow-hidden px-4"
          >
            <div className="relative pb-3 pl-6">
              <span className="absolute left-[9px] top-1 bottom-4 w-px bg-hairline" />
              {steps.map((s) => {
                const meta = AGENTS[s.agent] ?? { label: s.agent, role: "", icon: Bot };
                const Icon = meta.icon;
                const done = s.status === "done";
                return (
                  <motion.li
                    key={s.agent}
                    layout
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.25, ease }}
                    className="relative list-none py-1.5"
                  >
                    <span
                      className={cn(
                        "absolute -left-6 top-2 grid h-[19px] w-[19px] place-items-center rounded-full border",
                        done ? "border-brand bg-brand text-white" : "border-warm-mist bg-parchment text-graphite",
                      )}
                    >
                      {done ? <Check /> : <Icon size={11} />}
                    </span>
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <span className="text-body text-ink">{meta.label}</span>
                      <span className="text-body-sm text-ash">{meta.role}</span>
                      {s.end !== undefined && (
                        <span className="tabular ml-auto text-body-sm text-ash">{Math.max(0, s.end - s.start).toFixed(0)} ms</span>
                      )}
                    </div>
                    {s.detail && <div className="text-body-sm text-graphite">{s.detail}</div>}
                    {s.tools.length > 0 && (
                      <ul className="mt-1 space-y-0.5">
                        {s.tools.map((t, i) => (
                          <motion.li
                            key={i}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="flex items-baseline gap-2 font-mono text-[11.5px] text-graphite"
                          >
                            <span className="text-ink">{t.tool}</span>
                            <span className="truncate text-ash">{summarizeArgs(t.args)}</span>
                            <span className="ml-auto shrink-0 tabular">{t.result} · {t.ms?.toFixed(0)}ms</span>
                          </motion.li>
                        ))}
                      </ul>
                    )}
                  </motion.li>
                );
              })}
            </div>
          </motion.ol>
        )}
      </AnimatePresence>
    </div>
  );
}

function summarizeArgs(args?: Record<string, unknown>): string {
  if (!args) return "";
  return Object.entries(args)
    .filter(([, v]) => v !== null && v !== undefined && !(Array.isArray(v) && v.length === 0))
    .map(([k, v]) => `${k}=${Array.isArray(v) ? v.join(",") : String(v)}`)
    .join(" ")
    .slice(0, 90);
}
