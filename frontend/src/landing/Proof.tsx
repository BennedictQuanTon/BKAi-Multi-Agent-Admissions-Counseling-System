import { motion, useInView, useReducedMotion } from "framer-motion";
import { AudioWaveform, Check, Drama, Volume2, type LucideIcon } from "lucide-react";
import { useRef } from "react";
import {
  siCaddy,
  siDocker,
  siFastapi,
  siFfmpeg,
  siFramer,
  siGooglegemini,
  siHuggingface,
  siLanggraph,
  siLangchain,
  siLivekit,
  siLucide,
  siModelcontextprotocol,
  siNginx,
  siNumpy,
  siPydantic,
  siPython,
  siPytorch,
  siQdrant,
  siReact,
  siRedis,
  siSqlite,
  siTailwindcss,
  siTypescript,
  siVite,
  type SimpleIcon,
} from "simple-icons";
import { CountUp, EASE } from "./motion";

/* ── proof strip: each number carries a small picture of what it measures ─────────────────────── */

function Cases({ on }: { on: boolean }) {
  return (
    <div className="flex gap-1.5" aria-hidden="true">
      {Array.from({ length: 8 }, (_, i) => (
        <motion.span
          key={i}
          className="flex h-[22px] w-[22px] items-center justify-center rounded-[7px]"
          initial={{ backgroundColor: "#ececf0" }}
          animate={on ? { backgroundColor: "#1f6fe0" } : undefined}
          transition={{ duration: 0.35, delay: 0.15 + i * 0.09 }}
        >
          <motion.span initial={{ scale: 0 }} animate={on ? { scale: 1 } : undefined} transition={{ type: "spring", stiffness: 500, damping: 20, delay: 0.3 + i * 0.09 }}>
            <Check size={13} strokeWidth={3.2} className="text-white" />
          </motion.span>
        </motion.span>
      ))}
    </div>
  );
}

function Numbers({ on }: { on: boolean }) {
  return (
    <div className="flex h-[26px] items-end gap-[3px]" aria-hidden="true">
      {Array.from({ length: 40 }, (_, i) => (
        <motion.span
          key={i}
          className="w-[3px] rounded-full"
          initial={{ height: 6, backgroundColor: "#dcdce2" }}
          animate={on ? { height: 14 + ((i * 7) % 12), backgroundColor: "#1f6fe0" } : undefined}
          transition={{ duration: 0.5, ease: EASE, delay: 0.1 + i * 0.025 }}
        />
      ))}
    </div>
  );
}

function Ring({ on }: { on: boolean }) {
  return (
    <svg width="44" height="44" viewBox="0 0 44 44" aria-hidden="true">
      <circle cx="22" cy="22" r="18" fill="none" stroke="#ececf0" strokeWidth="5" />
      <motion.circle
        cx="22"
        cy="22"
        r="18"
        fill="none"
        stroke="#1f6fe0"
        strokeWidth="5"
        strokeLinecap="round"
        transform="rotate(-90 22 22)"
        initial={{ pathLength: 0 }}
        animate={on ? { pathLength: 1 } : undefined}
        transition={{ duration: 1.4, ease: EASE, delay: 0.15 }}
      />
      <motion.path
        d="M15 22.5 20 27.5 29.5 17"
        fill="none"
        stroke="#1d1d1f"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={on ? { pathLength: 1 } : undefined}
        transition={{ duration: 0.5, delay: 1.3 }}
      />
    </svg>
  );
}

function Speed({ on }: { on: boolean }) {
  return (
    <div className="w-full space-y-1.5 text-[11px] font-medium text-lp-quiet" aria-hidden="true">
      <div className="flex items-center gap-2">
        <span className="w-6">v4</span>
        <div className="h-[7px] flex-1 overflow-hidden rounded-full bg-[#ececf0]">
          <motion.div className="h-full rounded-full bg-[#c7c7cc]" initial={{ width: 0 }} animate={on ? { width: "100%" } : undefined} transition={{ duration: 1.6, ease: EASE }} />
        </div>
        <span className="tnum w-11 text-right">27.3 s</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="w-6 text-lp-source">v5</span>
        <div className="h-[7px] flex-1 overflow-hidden rounded-full bg-[#ececf0]">
          <motion.div className="h-full rounded-full bg-lp-source" initial={{ width: 0 }} animate={on ? { width: "6.6%" } : undefined} transition={{ duration: 0.6, ease: EASE, delay: 0.2 }} />
        </div>
        <span className="tnum w-11 text-right text-lp-source">1.8 s</span>
      </div>
    </div>
  );
}

const PROOF = [
  { big: "8/8", label: "real admission cases, correct", sub: "easy · medium · hard · out-of-scope", ref: 1, Viz: Cases },
  { big: "200/200", label: "numbers exactly right", sub: "cut-offs and quotas, 2024–2026", ref: 1, Viz: Numbers },
  { big: "100%", label: "answers verified", sub: "every number checked against its source", ref: 2, Viz: Ring },
  { big: "1.8 s", label: "median answer", sub: "15× faster than the previous version", ref: 1, Viz: Speed },
];

export function ProofStrip() {
  const ref = useRef<HTMLUListElement>(null);
  const inView = useInView(ref, { once: true, margin: "-10% 0px" });
  const reduce = useReducedMotion();
  const on = inView || !!reduce;
  return (
    <ul ref={ref} className="tile grid grid-cols-2 lg:grid-cols-4">
      {PROOF.map(({ big, label, sub, ref: r, Viz }, i) => (
        <motion.li
          key={label}
          className={`flex flex-col justify-between gap-6 p-6 md:p-7 ${i % 2 ? "border-l border-lp-hairline" : ""} ${i > 1 ? "max-lg:border-t max-lg:border-lp-hairline" : ""} ${i === 2 ? "lg:border-l lg:border-lp-hairline" : ""}`}
          initial={reduce ? false : { opacity: 0, y: 14 }}
          animate={on ? { opacity: 1, y: 0 } : undefined}
          transition={{ duration: 0.8, ease: EASE, delay: i * 0.08 }}
        >
          <div className="flex h-[44px] items-center">
            <Viz on={on} />
          </div>
          <div>
            <div className="font-[family-name:var(--font-lp-display)] text-[40px] font-medium leading-none tracking-[-0.035em] md:text-[46px]">
              <CountUp value={big} />
            </div>
            <p className="mt-2 text-[15px] font-semibold leading-tight">
              {label}
              <a href={`#ref-${r}`} className="ref" aria-label={`Reference ${r}`}>
                [{r}]
              </a>
            </p>
            <p className="mt-1 text-[13px] leading-snug text-lp-quiet">{sub}</p>
          </div>
        </motion.li>
      ))}
    </ul>
  );
}

/* ── the full stack, as a slow double marquee of real logos ───────────────────────────────────── */

type Tech = { name: string; icon?: SimpleIcon; glyph?: LucideIcon };

const ROW_A: Tech[] = [
  { name: "Python", icon: siPython },
  { name: "FastAPI", icon: siFastapi },
  { name: "Pydantic", icon: siPydantic },
  { name: "LangGraph", icon: siLanggraph },
  { name: "LangChain", icon: siLangchain },
  { name: "Gemini 3.5 Flash-Lite", icon: siGooglegemini },
  { name: "Qdrant", icon: siQdrant },
  { name: "SQLite", icon: siSqlite },
  { name: "Redis", icon: siRedis },
  { name: "Hugging Face", icon: siHuggingface },
  { name: "PyTorch", icon: siPytorch },
  { name: "NumPy", icon: siNumpy },
];
const ROW_B: Tech[] = [
  { name: "AssemblyAI", glyph: AudioWaveform },
  { name: "Kokoro-82M", glyph: Volume2 },
  { name: "LiveKit", icon: siLivekit },
  { name: "Model Context Protocol", icon: siModelcontextprotocol },
  { name: "Playwright", glyph: Drama },
  { name: "React 19", icon: siReact },
  { name: "TypeScript", icon: siTypescript },
  { name: "Vite", icon: siVite },
  { name: "Tailwind CSS", icon: siTailwindcss },
  { name: "Framer Motion", icon: siFramer },
  { name: "Lucide", icon: siLucide },
  { name: "Docker", icon: siDocker },
  { name: "Caddy", icon: siCaddy },
  { name: "Nginx", icon: siNginx },
  { name: "FFmpeg", icon: siFfmpeg },
];

/** Brand colour on hover; near-white brand colours fall back to ink so the logo stays visible. */
function tint(hex: string) {
  const n = parseInt(hex, 16);
  const l = (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255;
  return l > 0.8 || l < 0.12 ? "#1d1d1f" : `#${hex}`;
}

function Row({ items, reverse = false }: { items: Tech[]; reverse?: boolean }) {
  const doubled = [...items, ...items];
  return (
    <div className="marquee overflow-hidden py-2">
      <ul className={`marquee-track gap-3 ${reverse ? "marquee-rev" : ""}`} style={{ ["--dur" as string]: `${items.length * 5}s` }}>
        {doubled.map((t, i) => (
          <li
            key={`${t.name}-${i}`}
            aria-hidden={i >= items.length}
            className="group flex shrink-0 items-center gap-2.5 rounded-full bg-white px-4 py-2.5 shadow-[0_0_0_1px_rgba(0,0,0,0.06)] transition-shadow duration-300 hover:shadow-[0_0_0_1px_rgba(0,0,0,0.12),0_6px_18px_rgba(0,0,0,0.06)]"
          >
            {t.icon ? (
              <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" className="text-lp-ink/45 transition-colors duration-300 group-hover:[color:var(--c)]" style={{ ["--c" as string]: tint(t.icon.hex) }}>
                <path d={t.icon.path} fill="currentColor" />
              </svg>
            ) : (
              t.glyph && <t.glyph size={19} className="text-lp-ink/45 transition-colors group-hover:text-lp-source" />
            )}
            <span className="text-[14px] font-medium text-lp-ink/75 group-hover:text-lp-ink" translate="no">
              {t.name}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function StackMarquee() {
  return (
    <div>
      <p className="text-center text-[14px] font-medium text-lp-ash">Built with {ROW_A.length + ROW_B.length} technologies</p>
      <div className="mt-5 space-y-2">
        <Row items={ROW_A} />
        <Row items={ROW_B} reverse />
      </div>
    </div>
  );
}
