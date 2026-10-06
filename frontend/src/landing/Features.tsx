import { motion, useInView, useReducedMotion } from "framer-motion";
import { Captions, CaptionsOff, Check, Pause, Play, Volume2, VolumeX } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { FEATURES, type Feature } from "./content";
import { Cite, EASE, MaskHeading, Reveal } from "./motion";

/* ── the film: plays muted when it scrolls into view; viewers choose sound and captions ─────── */

function Film() {
  const video = useRef<HTMLVideoElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const inView = useInView(box, { amount: 0.45 });
  const reduce = useReducedMotion();
  const [muted, setMuted] = useState(true);
  const [captions, setCaptions] = useState(false);
  const [paused, setPaused] = useState(false);
  const [userPaused, setUserPaused] = useState(false);

  useEffect(() => {
    const v = video.current;
    if (!v) return;
    if (inView && !userPaused && !reduce) v.play().catch(() => setPaused(true));
    else v.pause();
  }, [inView, userPaused, reduce]);

  useEffect(() => {
    const track = video.current?.textTracks?.[0];
    if (track) track.mode = captions ? "showing" : "hidden";
  }, [captions]);

  const toggleSound = () => {
    const v = video.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
    if (!v.muted && v.paused) v.play().catch(() => undefined);
  };
  const togglePlay = () => {
    const v = video.current;
    if (!v) return;
    if (v.paused) {
      setUserPaused(false);
      v.play().catch(() => undefined);
    } else {
      setUserPaused(true);
      v.pause();
    }
  };
  const btn = "flex h-10 w-10 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-md transition-colors hover:bg-black/65";

  return (
    <Reveal y={40}>
      <div ref={box} className="group relative overflow-hidden rounded-[28px] bg-lp-board shadow-[0_30px_80px_-30px_rgba(0,0,0,0.25)]">
        <video
          ref={video}
          className="aspect-video w-full bg-lp-canvas"
          poster="/media/trailer/bkai-trailer.jpg"
          muted
          loop
          playsInline
          preload="metadata"
          onPlay={() => setPaused(false)}
          onPause={() => setPaused(true)}
          aria-label="BKAi, a 60-second film"
        >
          <source src="/media/trailer/bkai-trailer-mobile.mp4" type="video/mp4" media="(max-width: 767px)" />
          <source src="/media/trailer/bkai-trailer-web.mp4" type="video/mp4" />
          <track kind="captions" src="/media/trailer/bkai-trailer.vtt" srcLang="en" label="English" />
        </video>
        <div className="absolute bottom-4 left-4 flex gap-2">
          <button type="button" onClick={togglePlay} className={btn} aria-label={paused ? "Play the film" : "Pause the film"}>
            {paused ? <Play size={16} fill="currentColor" className="ml-0.5" /> : <Pause size={16} fill="currentColor" />}
          </button>
        </div>
        <div className="absolute bottom-4 right-4 flex gap-2">
          <button type="button" onClick={() => setCaptions((c) => !c)} className={btn} aria-pressed={captions} aria-label={captions ? "Hide captions" : "Show captions"}>
            {captions ? <Captions size={17} /> : <CaptionsOff size={17} />}
          </button>
          <button type="button" onClick={toggleSound} className={`${btn} ${muted ? "w-auto gap-2 px-3.5" : ""}`} aria-pressed={!muted} aria-label={muted ? "Turn sound on" : "Turn sound off"}>
            {muted ? <VolumeX size={17} /> : <Volume2 size={17} />}
            {muted && <span className="text-[13px] font-medium max-sm:hidden">Sound on</span>}
          </button>
        </div>
      </div>
    </Reveal>
  );
}

/* ── bento visuals ─────────────────────────────────────────────────────────────────────────────── */

function useOn() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-10% 0px" });
  const reduce = useReducedMotion();
  return [ref, inView || !!reduce] as const;
}

const LANES = [
  { k: "Supervisor", a: 0, b: 30, tone: "#1d1d1f" },
  { k: "Data agent", a: 31, b: 33, tone: "#1f6fe0" },
  { k: "Policy agent", a: 31, b: 46, tone: "#1f6fe0" },
  { k: "Counsel agent", a: 31, b: 34, tone: "#1f6fe0" },
  { k: "Synthesizer", a: 47, b: 92, tone: "#3aa0f0" },
  { k: "Verifier", a: 93, b: 95, tone: "#0d2f86" },
];
function AgentsViz() {
  const [ref, on] = useOn();
  return (
    <div ref={ref} className="space-y-2.5">
      {LANES.map((l, i) => (
        <div key={l.k} className="grid grid-cols-[104px_1fr] items-center gap-3 text-[12px] font-medium text-lp-quiet">
          <span>{l.k}</span>
          <div className="relative h-[10px] rounded-full bg-lp-cloud">
            <motion.span
              className="absolute top-0 h-full rounded-full"
              style={{ left: `${l.a}%`, background: l.tone }}
              initial={{ width: 0 }}
              animate={on ? { width: `${Math.max(l.b - l.a, 1.5)}%` } : undefined}
              transition={{ duration: 0.9, ease: EASE, delay: 0.2 + (l.a / 100) * 1.4 }}
            />
          </div>
        </div>
      ))}
      <div className="grid grid-cols-[104px_1fr] gap-3 text-[11px] text-lp-ash">
        <span />
        <div className="flex justify-between tnum">
          <span>0 s</span>
          <span>parallel</span>
          <span>≈ 2 s</span>
        </div>
      </div>
    </div>
  );
}

function VerifierViz() {
  const [ref, on] = useOn();
  const nums = ["85.45", "84.23", "78.69", "70.84"];
  return (
    <div ref={ref} className="flex flex-wrap gap-2">
      {nums.map((n, i) => (
        <motion.span
          key={n}
          className="tnum flex items-center gap-1.5 rounded-full bg-lp-cloud py-1.5 pl-3 pr-1.5 text-[15px] font-semibold"
          initial={{ opacity: 0, y: 8 }}
          animate={on ? { opacity: 1, y: 0 } : undefined}
          transition={{ duration: 0.5, ease: EASE, delay: 0.1 + i * 0.12 }}
        >
          {n}
          <motion.span
            className="flex h-5 w-5 items-center justify-center rounded-full bg-lp-source text-white"
            initial={{ scale: 0 }}
            animate={on ? { scale: 1 } : undefined}
            transition={{ type: "spring", stiffness: 500, damping: 18, delay: 0.6 + i * 0.18 }}
          >
            <Check size={12} strokeWidth={3.2} />
          </motion.span>
        </motion.span>
      ))}
    </div>
  );
}

function RetrievalViz() {
  const [ref, on] = useOn();
  const rows = [
    { k: "MiniLM (v4)", v: 0.475 },
    { k: "VN-Embedding v2", v: 0.813 },
    { k: "+ rerank (v5)", v: 0.828 },
  ];
  return (
    <div ref={ref} className="space-y-2">
      {rows.map((r, i) => (
        <div key={r.k}>
          <div className="flex justify-between text-[12px] font-medium text-lp-quiet">
            <span>{r.k}</span>
            <span className={`tnum ${i === 2 ? "text-lp-source" : ""}`}>Hit@1 {r.v.toFixed(3)}</span>
          </div>
          <div className="mt-1 h-[8px] rounded-full bg-lp-cloud">
            <motion.div
              className={`h-full rounded-full ${i === 2 ? "bg-lp-source" : "bg-[#c7c7cc]"}`}
              initial={{ width: 0 }}
              animate={on ? { width: `${r.v * 100}%` } : undefined}
              transition={{ duration: 1.1, ease: EASE, delay: 0.15 + i * 0.15 }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function VoiceViz() {
  const [ref, on] = useOn();
  const reduce = useReducedMotion();
  return (
    <div ref={ref} className="flex h-[56px] items-center gap-[3px]" aria-hidden="true">
      {Array.from({ length: 34 }, (_, i) => {
        const base = 8 + Math.abs(Math.sin(i * 0.9) * 30) + (i % 5) * 3;
        return (
          <motion.span
            key={i}
            className="w-[4px] rounded-full bg-lp-source"
            style={{ opacity: 0.35 + (i % 7) / 10 }}
            initial={{ height: 4 }}
            animate={on ? (reduce ? { height: base } : { height: [base * 0.4, base, base * 0.6, base * 0.9] }) : undefined}
            transition={reduce ? undefined : { duration: 1.4, repeat: Infinity, repeatType: "mirror", ease: "easeInOut", delay: (i % 9) * 0.07 }}
          />
        );
      })}
    </div>
  );
}

function ObservabilityViz() {
  const [ref, on] = useOn();
  const rows = [
    { k: "guard", a: 0, w: 1 },
    { k: "supervisor", a: 1, w: 34 },
    { k: "tools", a: 35, w: 2 },
    { k: "gemini", a: 37, w: 58 },
    { k: "verifier", a: 95, w: 1 },
  ];
  return (
    <div ref={ref} className="space-y-1.5 font-mono text-[11px] text-lp-quiet">
      {rows.map((r, i) => (
        <div key={r.k} className="grid grid-cols-[72px_1fr] items-center gap-2">
          <span>{r.k}</span>
          <div className="relative h-[12px]">
            <motion.span
              className={`absolute top-0 h-full rounded-[4px] ${r.k === "gemini" ? "bg-lp-sky" : "bg-[#86868b]"}`}
              style={{ left: `${r.a}%` }}
              initial={{ width: 0 }}
              animate={on ? { width: `${Math.max(r.w, 1)}%` } : undefined}
              transition={{ duration: 0.8, ease: EASE, delay: 0.15 + i * 0.12 }}
            />
            {r.k === "gemini" && <span className="absolute top-[-3px] h-[18px] w-[2px] bg-lp-ink" style={{ left: "52%" }} title="first token" />}
          </div>
        </div>
      ))}
    </div>
  );
}

const VISUALS: Partial<Record<string, () => ReactNode>> = {
  "Multi-agent orchestration": () => <AgentsViz />,
  "Deterministic verifier": () => <VerifierViz />,
  "Hybrid retrieval": () => <RetrievalViz />,
  "Vietnamese voice": () => <VoiceViz />,
  Observability: () => <ObservabilityViz />,
};

// 12-column bento: hero tiles carry a live visual, the rest lead with their number.
const LAYOUT: { title: string; span: string; kicker: string }[] = [
  { title: "Multi-agent orchestration", span: "lg:col-span-7", kicker: "Agents" },
  { title: "Deterministic verifier", span: "lg:col-span-5", kicker: "Accuracy" },
  { title: "Facts in SQL, not in chunks", span: "lg:col-span-4", kicker: "Accuracy" },
  { title: "Hybrid retrieval", span: "lg:col-span-4", kicker: "Retrieval" },
  { title: "Vietnamese voice", span: "lg:col-span-4", kicker: "Voice" },
  { title: "Entity resolver", span: "lg:col-span-3", kicker: "Understanding" },
  { title: "Corrective second hop", span: "lg:col-span-3", kicker: "Retrieval" },
  { title: "Contextual chunks", span: "lg:col-span-3", kicker: "Retrieval" },
  { title: "Memory that lasts", span: "lg:col-span-3", kicker: "Conversation" },
  { title: "Observability", span: "lg:col-span-6", kicker: "Operations" },
  { title: "Entity-guarded cache", span: "lg:col-span-3", kicker: "Speed" },
  { title: "Score calculator", span: "lg:col-span-3", kicker: "Counseling" },
  { title: "MCP server", span: "lg:col-span-4", kicker: "Platform" },
  { title: "Built to deploy", span: "lg:col-span-4", kicker: "Security" },
  { title: "Validated data pipeline", span: "lg:col-span-4", kicker: "Data" },
];

function Tile({ f, span, kicker, i }: { f: Feature; span: string; kicker: string; i: number }) {
  const visual = VISUALS[f.title];
  const big = !visual;
  return (
    <Reveal
      as="li"
      delay={(i % 4) * 0.06}
      className={`group relative flex flex-col justify-between overflow-hidden rounded-[28px] bg-white p-7 shadow-[0_0_0_1px_rgba(0,0,0,0.04)] transition-shadow duration-500 hover:shadow-[0_0_0_1px_rgba(0,0,0,0.06),0_24px_50px_-24px_rgba(0,0,0,0.18)] sm:col-span-1 ${span} ${
        visual ? "min-h-[300px]" : "min-h-[240px]"
      }`}
    >
      <div>
        <p className="text-[13px] font-semibold text-lp-source">{kicker}</p>
        <h3 className="mt-1.5 text-[21px] font-semibold leading-[1.2] tracking-[-0.015em]">{f.title}</h3>
        <p className="mt-2 max-w-[460px] text-[15px] leading-[1.5] text-lp-quiet">
          {f.body}
          <Cite ids={f.refs} />
        </p>
      </div>
      {visual ? (
        <div className="mt-7">
          {visual()}
          <p className="mt-5 text-[14px] font-semibold text-lp-ink">{f.metric}</p>
        </div>
      ) : (
        <p
          className={`mt-6 font-[family-name:var(--font-lp-display)] font-medium leading-none tracking-[-0.035em] ${
            big && f.metric.length <= 14 ? "text-[42px]" : "text-[28px]"
          } bg-gradient-to-br from-lp-navy to-lp-source bg-clip-text text-transparent`}
        >
          {f.metric}
        </p>
      )}
    </Reveal>
  );
}

export default function Features() {
  const byTitle = Object.fromEntries(FEATURES.map((f) => [f.title, f]));
  return (
    <section id="trailer" className="section bg-lp-cloud" aria-labelledby="features-heading">
      <div className="container-l">
        <div className="mx-auto max-w-[760px] text-center">
          <Reveal>
            <p className="eyebrow">Features</p>
          </Reveal>
          <MaskHeading id="features-heading" className="h2 mt-3" lines={["Everything it does,", "in sixty seconds."]} />
          <Reveal delay={0.1}>
            <p className="lead mx-auto mt-4 max-w-[600px]">A one-minute film, voiced with Kokoro and scored in code. Turn on sound and captions anytime.</p>
          </Reveal>
        </div>

        <div className="mx-auto mt-12 max-w-[1040px]">
          <Film />
        </div>

        <div className="mt-24 max-w-[760px]">
          <MaskHeading className="h2" lines={["Fifteen parts.", "Each one measured."]} />
        </div>
        <ul className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-12">
          {LAYOUT.map((l, i) => (
            <Tile key={l.title} f={byTitle[l.title]} span={l.span} kicker={l.kicker} i={i} />
          ))}
        </ul>
      </div>
    </section>
  );
}
