import { motion, useInView, useReducedMotion } from "framer-motion";
import { Check, Database } from "lucide-react";
import { useRef, type ReactNode } from "react";
import { STORY } from "./content";
import { Cite, EASE, MaskHeading, Reveal } from "./motion";

/* ── three illustrations, drawn in the DOM so they stay sharp and animate in ─────────────────── */

const CUT = [
  { y: "2023", v: 68.73 },
  { y: "2024", v: 78.22 },
  { y: "2025", v: 76.34 },
  { y: "2026", v: 79.3 },
];

function ProblemViz({ on }: { on: boolean }) {
  return (
    <div className="flex h-full flex-col justify-end px-6 pb-6 pt-8">
      <div className="mb-auto flex flex-wrap gap-2">
        {["74 admission codes", "9 programs", "2 methods"].map((c, i) => (
          <motion.span
            key={c}
            className="rounded-full bg-lp-cloud px-3 py-1 text-[12px] font-medium text-lp-copy"
            initial={{ opacity: 0, y: 8 }}
            animate={on ? { opacity: 1, y: 0 } : undefined}
            transition={{ duration: 0.6, ease: EASE, delay: 0.1 + i * 0.1 }}
          >
            {c}
          </motion.span>
        ))}
      </div>
      <p className="mb-3 text-[12px] font-medium text-lp-quiet">Automotive Engineering · 142 · cut-off by year</p>
      <div className="flex h-[150px] items-end gap-3">
        {CUT.map((c, i) => {
          const h = ((c.v - 60) / 22) * 100;
          const last = i === CUT.length - 1;
          return (
            <div key={c.y} className="flex flex-1 flex-col items-center gap-2">
              <motion.span
                className={`tnum text-[13px] font-semibold ${last ? "text-lp-source" : "text-lp-ink"}`}
                initial={{ opacity: 0 }}
                animate={on ? { opacity: 1 } : undefined}
                transition={{ delay: 0.5 + i * 0.15 }}
              >
                {c.v.toFixed(2)}
              </motion.span>
              <div className="flex h-[96px] w-full items-end">
                <motion.div
                  className={`w-full rounded-[10px] ${last ? "bg-lp-source" : "bg-[#d2d2d7]"}`}
                  initial={{ height: 0 }}
                  animate={on ? { height: `${h}%` } : undefined}
                  transition={{ duration: 1.1, ease: EASE, delay: 0.3 + i * 0.15 }}
                />
              </div>
              <span className="text-[12px] text-lp-quiet">{c.y}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const NODES = [
  { k: "q", label: "Question", x: 50, y: 12 },
  { k: "s", label: "Supervisor", x: 50, y: 34 },
  { k: "d", label: "Data", x: 18, y: 58 },
  { k: "p", label: "Policy", x: 50, y: 58 },
  { k: "c", label: "Counsel", x: 82, y: 58 },
  { k: "v", label: "Verifier", x: 50, y: 86 },
];
const EDGES = [
  ["q", "s"],
  ["s", "d"],
  ["s", "p"],
  ["s", "c"],
  ["d", "v"],
  ["p", "v"],
  ["c", "v"],
];

function ApproachViz({ on }: { on: boolean }) {
  const reduce = useReducedMotion();
  const pos = Object.fromEntries(NODES.map((n) => [n.k, n]));
  return (
    <div className="relative h-full">
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        {EDGES.map(([a, b], i) => {
          const A = pos[a], B = pos[b];
          const d = `M${A.x} ${A.y} C ${A.x} ${(A.y + B.y) / 2}, ${B.x} ${(A.y + B.y) / 2}, ${B.x} ${B.y}`;
          return (
            <g key={i}>
              <motion.path d={d} fill="none" stroke="#c7c7cc" strokeWidth="1.5" vectorEffect="non-scaling-stroke" initial={{ opacity: 0 }} animate={on ? { opacity: 1 } : undefined} transition={{ duration: 0.6, delay: 0.2 + i * 0.08 }} />
              {!reduce && on && (
                <circle r="1.4" fill="#1f6fe0">
                  <animateMotion dur="2.4s" begin={`${1 + (i % 4) * 0.35}s`} repeatCount="indefinite" path={d} />
                </circle>
              )}
            </g>
          );
        })}
      </svg>
      {NODES.map((n, i) => (
        <motion.div
          key={n.k}
          className={`absolute flex -translate-x-1/2 -translate-y-1/2 items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-[12px] font-semibold shadow-[0_0_0_1px_rgba(0,0,0,0.06),0_4px_12px_rgba(0,0,0,0.05)] ${
            n.k === "v" ? "bg-lp-source text-white" : "bg-white text-lp-ink"
          }`}
          style={{ left: `${n.x}%`, top: `${n.y}%` }}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={on ? { opacity: 1, scale: 1 } : undefined}
          transition={{ type: "spring", stiffness: 400, damping: 24, delay: 0.1 + i * 0.1 }}
        >
          {n.k === "v" && <Check size={12} strokeWidth={3} />}
          {n.label}
        </motion.div>
      ))}
    </div>
  );
}

function ResultViz({ on }: { on: boolean }) {
  return (
    <div className="flex h-full flex-col justify-center gap-3 px-6 py-6">
      <motion.div
        className="self-end rounded-[16px] rounded-br-[6px] bg-lp-cloud px-3.5 py-2 text-[13px]"
        initial={{ opacity: 0, y: 8 }}
        animate={on ? { opacity: 1, y: 0 } : undefined}
        transition={{ duration: 0.6, ease: EASE, delay: 0.1 }}
      >
        Điểm chuẩn KHMT Nhật Bản 2026?
      </motion.div>
      <motion.div
        className="rounded-[16px] bg-white p-4 shadow-[0_0_0_1px_rgba(0,0,0,0.06),0_10px_30px_rgba(0,0,0,0.06)]"
        initial={{ opacity: 0, y: 12 }}
        animate={on ? { opacity: 1, y: 0 } : undefined}
        transition={{ duration: 0.7, ease: EASE, delay: 0.35 }}
      >
        <p className="text-[13px] text-lp-quiet">Khoa học Máy tính · 266 · Định hướng Nhật Bản</p>
        <p className="mt-1 flex items-baseline gap-2">
          <span className="tnum font-[family-name:var(--font-lp-display)] text-[34px] font-medium tracking-[-0.03em]">78.69</span>
          <span className="rounded-full bg-lp-cloud px-1.5 text-[11px] font-semibold">3</span>
        </p>
        <div className="mt-3 flex items-center gap-2 border-t border-lp-hairline pt-3 text-[12px] text-lp-quiet">
          <Database size={13} /> hcmut.edu.vn · official cut-off 2026
        </div>
      </motion.div>
      <motion.div
        className="flex items-center gap-2 self-start rounded-full bg-lp-source/10 px-3 py-1.5 text-[12px] font-semibold text-lp-source"
        initial={{ opacity: 0, scale: 0.85 }}
        animate={on ? { opacity: 1, scale: 1 } : undefined}
        transition={{ type: "spring", stiffness: 400, damping: 20, delay: 0.8 }}
      >
        <Check size={13} strokeWidth={3} /> Every number verified · 1.8 s
      </motion.div>
    </div>
  );
}

const VIZ = [ProblemViz, ApproachViz, ResultViz];

function Frame({ children }: { children: (on: boolean) => ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-15% 0px" });
  const reduce = useReducedMotion();
  return (
    <div ref={ref} className="relative mx-4 mb-4 aspect-[5/4] overflow-hidden rounded-[22px] bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.04)]">
      {children(inView || !!reduce)}
    </div>
  );
}

export default function Story() {
  return (
    <section id="story" className="section bg-lp-cloud" aria-labelledby="story-heading">
      <div className="container-l">
        <div className="max-w-[820px]">
          <Reveal>
            <p className="eyebrow">Background</p>
          </Reveal>
          <MaskHeading id="story-heading" className="h2 mt-3" lines={["One question, asked every summer:", "“What score do I need?”"]} />
          <Reveal delay={0.1}>
            <p className="lead mt-5">
              BKAi is an AI admissions counselor for Ho Chi Minh City University of Technology (HCMUT, VNU-HCM). An independent project, designed, built and
              evaluated by Long Quan Ton between May and October 2026.
            </p>
          </Reveal>
        </div>

        <ul className="mt-14 grid gap-5 lg:grid-cols-3">
          {STORY.map((s, i) => {
            const Viz = VIZ[i];
            return (
              <Reveal as="li" key={s.k} delay={i * 0.1} className="flex flex-col overflow-hidden rounded-[28px] bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.04),0_20px_40px_-24px_rgba(0,0,0,0.12)]">
                <div className="flex-1 px-7 pb-6 pt-7">
                  <p className="text-[14px] font-semibold text-lp-source">{s.k}</p>
                  <h3 className="mt-2 font-[family-name:var(--font-lp-display)] text-[26px] font-medium leading-[1.15] tracking-[-0.02em]">{s.title}</h3>
                  <p className="mt-3 text-[15px] leading-[1.55] text-lp-quiet">
                    {s.body}
                    <Cite ids={s.refs} />
                  </p>
                </div>
                <div className="bg-lp-cloud/60 pt-4">
                  <Frame>{(on) => <Viz on={on} />}</Frame>
                </div>
              </Reveal>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
