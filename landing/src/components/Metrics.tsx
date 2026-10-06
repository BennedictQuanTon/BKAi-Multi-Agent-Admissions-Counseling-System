import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import { useState, type ReactNode } from "react";
import { LATENCY_ROWS, QUALITY_ROWS, REFS, RETRIEVAL_ROWS, TECHNIQUE_ROWS, VERSION_TABLE, type Cell } from "../content";
import { Cite, CountUp, EASE, MaskHeading, Reveal } from "../lib/motion";

const KPIS = [
  { v: "8 / 8", l: "real cases correct", r: 1 },
  { v: "40 / 40", l: "numbers exactly right", r: 1 },
  { v: "15×", l: "faster than v4 (27.3 s → 1.79 s)", r: 6 },
  { v: "0.875", l: "retrieval Hit@1, 80 queries", r: 3 },
  { v: "109 ms", l: "BKAi's own processing, p50", r: 2 },
  { v: "1.26%", l: "speech recognition error", r: 4 },
];

const TABS = ["Versions", "Accuracy", "Latency", "Retrieval", "Techniques"] as const;
type Tab = (typeof TABS)[number];

function Table({ head, children, minWidth = 640 }: { head: ReactNode[]; children: ReactNode; minWidth?: number }) {
  return (
    <div className="scroll-x -mx-4 px-4 md:mx-0 md:px-0">
      <table className="w-full border-collapse text-left text-[14px]" style={{ minWidth }}>
        <thead>
          <tr className="border-b border-ink/80">
            {head.map((h, i) => (
              <th key={i} scope="col" className="py-3 pr-4 text-[13px] font-semibold text-ink">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="[&>tr]:border-b [&>tr]:border-hairline">{children}</tbody>
      </table>
    </div>
  );
}

function VersionCell({ c }: { c: Cell }) {
  if (typeof c === "string") return <span className="text-copy">{c}</span>;
  const cls =
    c.kind === "claimed"
      ? "italic text-ash"
      : c.kind === "audit"
        ? "font-medium text-[#b4542d]"
        : c.kind === "measured"
          ? "font-semibold text-source"
          : "font-medium text-ink";
  return (
    <span className={`tnum ${cls}`}>
      {c.t}
      {c.ref && <Cite ids={[c.ref]} />}
    </span>
  );
}

function Panel({ tab }: { tab: Tab }) {
  if (tab === "Versions")
    return (
      <>
        <Table head={VERSION_TABLE.head} minWidth={900}>
          {VERSION_TABLE.rows.map((row, i) => (
            <tr key={i}>
              {row.map((c, j) => (
                <td key={j} className={`py-3 pr-4 align-top ${j === 0 ? "w-[150px] font-medium text-quiet" : ""} ${j === 5 ? "bg-paper/60 pl-3" : ""}`}>
                  <VersionCell c={c} />
                </td>
              ))}
            </tr>
          ))}
        </Table>
        <p className="mt-4 text-[13px] text-quiet">
          <span className="italic text-ash">Grey italic</span> = claimed in that version's README, with no artifact. <span className="font-medium text-[#b4542d]">Orange</span> = v4 re-run by hand on 2026-10-05. <span className="font-semibold text-source">Blue</span> = produced by a committed benchmark.
        </p>
      </>
    );
  if (tab === "Accuracy")
    return (
      <Table head={["Suite", "n", "Result", "Notes", "Source"]} minWidth={720}>
        {QUALITY_ROWS.map(([s, n, r, note, ref]) => (
          <tr key={s}>
            <td className="py-3 pr-4 font-medium">{s}</td>
            <td className="tnum py-3 pr-4 text-copy">{n}</td>
            <td className="tnum py-3 pr-4 font-semibold">{r}</td>
            <td className="py-3 pr-4 text-copy">{note}</td>
            <td className="py-3">
              <Cite ids={[ref]} />
            </td>
          </tr>
        ))}
      </Table>
    );
  if (tab === "Latency")
    return (
      <>
        <Table head={["Measure", "Result", "Scope", "Source"]} minWidth={680}>
          {LATENCY_ROWS.map(([m, r, scope, ref]) => (
            <tr key={m}>
              <td className="py-3 pr-4 font-medium">{m}</td>
              <td className="tnum py-3 pr-4 font-semibold">{r}</td>
              <td className="py-3 pr-4 text-copy">{scope}</td>
              <td className="py-3">
                <Cite ids={[ref]} />
              </td>
            </tr>
          ))}
        </Table>
        <p className="mt-4 max-w-[820px] text-[13px] text-quiet">
          Steady-state excludes 48 of 211 LLM requests: 6 first calls after a restart, 8 Gemini 503/504 failovers, 31 answered by the fallback model after the
          free-tier quota (15 requests / minute) ran out, and 3 provider stalls. Including them, p50 is 2.6 s and p95 11.2 s. The tail comes from the provider; BKAi's
          own processing stays near 0.1 s.
          <Cite ids={[2]} />
        </p>
      </>
    );
  if (tab === "Retrieval")
    return (
      <>
        <Table head={["Configuration", "Hit@1", "Hit@5", "MRR@10", "p50"]} minWidth={640}>
          {RETRIEVAL_ROWS.map((r) => (
            <tr key={r.cfg} className={r.best ? "bg-paper/60" : ""}>
              <td className={`py-3 pr-4 ${r.best ? "pl-3 font-semibold" : ""}`}>{r.cfg}</td>
              <td className={`tnum py-3 pr-4 ${r.best ? "font-semibold text-source" : "text-copy"}`}>{r.h1}</td>
              <td className="tnum py-3 pr-4 text-copy">{r.h5}</td>
              <td className={`tnum py-3 pr-4 ${r.best ? "font-semibold text-source" : "text-copy"}`}>{r.mrr}</td>
              <td className="tnum py-3 text-copy">{r.p50}</td>
            </tr>
          ))}
        </Table>
        <p className="mt-4 text-[13px] text-quiet">
          80 labelled queries (50 policy, 30 major) on the v5 corpus, CPU. The Vietnamese-specific reranker scored lower than bge-reranker-base on this data, so it was not shipped.
          <Cite ids={[3, 15, 16]} />
        </p>
      </>
    );
  return (
    <Table head={["Technique", "Replaced", "Effect", "Source"]} minWidth={760}>
      {TECHNIQUE_ROWS.map(([t, was, effect, refs]) => (
        <tr key={t}>
          <td className="py-3 pr-4 font-medium">{t}</td>
          <td className="py-3 pr-4 text-ash line-through decoration-ash/50">{was}</td>
          <td className="py-3 pr-4 text-copy">{effect}</td>
          <td className="py-3">
            <Cite ids={refs} />
          </td>
        </tr>
      ))}
    </Table>
  );
}

export default function Metrics() {
  const [tab, setTab] = useState<Tab>("Versions");
  const reduce = useReducedMotion();
  return (
    <section id="metrics" className="section" aria-labelledby="metrics-heading">
      <div className="container-l">
        <div className="max-w-[760px]">
          <Reveal>
            <p className="eyebrow">Evidence</p>
          </Reveal>
          <MaskHeading id="metrics-heading" className="h2 mt-4" lines={["The numbers, with receipts."]} />
          <Reveal delay={0.1}>
            <p className="lead mt-4">Every figure on this page links to the script and the report that produced it. Nothing here is a projection.</p>
          </Reveal>
        </div>

        <ul className="mt-12 grid grid-cols-2 gap-px overflow-hidden rounded-[12px] bg-hairline shadow-[0_0_0_1px_var(--color-hairline)] md:grid-cols-3 lg:grid-cols-6">
          {KPIS.map((k, i) => (
            <Reveal as="li" key={k.l} delay={i * 0.05} className="bg-canvas p-5">
              <div className="font-display text-[30px] font-medium leading-none tracking-[-0.03em]">
                <CountUp value={k.v} />
              </div>
              <p className="mt-2 text-[13px] leading-[1.4] text-quiet">
                {k.l}
                <Cite ids={[k.r]} />
              </p>
            </Reveal>
          ))}
        </ul>

        <div className="mt-12">
          <div role="tablist" aria-label="Metric tables" className="scroll-x inline-flex max-w-full gap-1 rounded-full bg-cloud p-1">
            {TABS.map((t) => (
              <button
                key={t}
                role="tab"
                aria-selected={tab === t}
                onClick={() => setTab(t)}
                className={`relative shrink-0 rounded-full px-3.5 py-2 text-[13px] font-medium leading-none ${tab === t ? "text-ink" : "text-quiet hover:text-ink"}`}
              >
                {tab === t && <motion.span layoutId="metric-pill" className="absolute inset-0 rounded-full bg-canvas shadow-[var(--shadow-pill)]" transition={{ type: "spring", stiffness: 500, damping: 40 }} />}
                <span className="relative">{t}</span>
              </button>
            ))}
          </div>
          <div className="mt-6 min-h-[420px]">
            <AnimatePresence mode="wait">
              <motion.div
                key={tab}
                role="tabpanel"
                initial={reduce ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.35, ease: EASE }}
              >
                <Panel tab={tab} />
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        <div className="mt-16 border-t border-hairline pt-8" id="references">
          <h3 className="text-[16px] font-semibold">References</h3>
          <ol className="mt-4 grid gap-x-10 gap-y-2.5 text-[13px] leading-[1.5] md:grid-cols-2">
            {REFS.map((r) => (
              <li key={r.id} id={`ref-${r.id}`} className="flex scroll-mt-28 gap-2.5 target:rounded-[6px] target:bg-source/10">
                <span className="tnum w-6 shrink-0 text-quiet">[{r.id}]</span>
                <span>
                  <span className="text-copy">{r.label}. </span>
                  <a href={r.href} target="_blank" rel="noreferrer" className="link-blue inline-flex items-center gap-0.5 break-all">
                    {r.source}
                    <ArrowUpRight size={12} />
                  </a>
                </span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
