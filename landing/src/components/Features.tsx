import { motion, useReducedMotion } from "framer-motion";
import {
  Activity,
  Brain,
  Calculator,
  Database,
  Languages,
  Layers,
  Lock,
  Mic,
  Network,
  Play,
  Plug,
  RotateCcw,
  Search,
  ShieldCheck,
  Workflow,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { useRef, useState } from "react";
import { FEATURES } from "../content";
import { Cite, EASE, MaskHeading, Reveal } from "../lib/motion";

const ICONS: Record<string, LucideIcon> = { Activity, Brain, Calculator, Database, Languages, Layers, Lock, Mic, Network, Plug, RotateCcw, Search, ShieldCheck, Workflow, Zap };

function Trailer() {
  const video = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const reduce = useReducedMotion();
  const start = () => {
    const v = video.current;
    if (!v) return;
    v.muted = false;
    v.currentTime = 0;
    v.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
  };
  return (
    <Reveal y={40}>
      <div className="relative overflow-hidden rounded-[12px] bg-board shadow-[var(--shadow-float)]">
        <video
          ref={video}
          className="aspect-video w-full bg-canvas"
          poster="/media/trailer/bkai-trailer.jpg"
          controls={playing}
          playsInline
          preload="none"
          onEnded={() => setPlaying(false)}
          onPause={(e) => e.currentTarget.ended && setPlaying(false)}
        >
          <source src="/media/trailer/bkai-trailer-mobile.mp4" type="video/mp4" media="(max-width: 767px)" />
          <source src="/media/trailer/bkai-trailer-web.mp4" type="video/mp4" />
          <track kind="captions" src="/media/trailer/bkai-trailer.vtt" srcLang="en" label="English" default />
        </video>
        {!playing && (
          <button type="button" onClick={start} className="group absolute inset-0 flex items-end justify-center pb-3 sm:pb-[7%]" aria-label="Play the BKAi film with sound">
            <motion.span
              className="flex items-center gap-3 rounded-full bg-ink py-2 pl-2.5 pr-4 text-[14px] font-semibold text-white shadow-[var(--shadow-overlay)] sm:py-3.5 sm:pl-4 sm:pr-6 sm:text-[16px]"
              whileHover={reduce ? undefined : { scale: 1.04 }}
              transition={{ duration: 0.4, ease: EASE }}
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-ink">
                <Play size={16} fill="currentColor" className="ml-0.5" />
              </span>
              Play the film · 1:00
            </motion.span>
          </button>
        )}
      </div>
    </Reveal>
  );
}

export default function Features() {
  return (
    <section id="trailer" className="section bg-cloud" aria-labelledby="features-heading">
      <div className="container-l">
        <div className="mx-auto max-w-[760px] text-center">
          <Reveal>
            <p className="eyebrow">Features</p>
          </Reveal>
          <MaskHeading id="features-heading" className="h2 mt-4" lines={["Everything it does,", "in sixty seconds."]} />
          <Reveal delay={0.1}>
            <p className="lead mx-auto mt-4 max-w-[600px]">A one-minute film, voiced with Kokoro and scored in code. Then the full list, each with the number that backs it.</p>
          </Reveal>
        </div>

        <div className="mx-auto mt-12 max-w-[1000px]">
          <Trailer />
        </div>

        <ul className="mt-16 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => {
            const Icon = ICONS[f.icon] ?? Activity;
            return (
              <Reveal as="li" key={f.title} delay={(i % 3) * 0.07} className="group flex flex-col rounded-[8px] bg-canvas p-6 shadow-[0_0_0_1px_var(--color-hairline)] transition-shadow duration-300 hover:shadow-[0_0_0_1px_rgba(0,0,0,0.14)]">
                <span className="flex h-9 w-9 items-center justify-center rounded-[8px] bg-paper text-ink transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:-translate-y-0.5">
                  <Icon size={18} strokeWidth={1.8} />
                </span>
                <h3 className="mt-4 text-[17px] font-semibold">{f.title}</h3>
                <p className="mt-1.5 flex-1 text-[15px] leading-[1.55] text-copy">{f.body}</p>
                <p className="mt-4 inline-flex w-fit items-center gap-1.5 rounded-[6px] bg-paper px-2.5 py-1 text-[13px] font-medium text-ink tnum">
                  <span className="h-1.5 w-1.5 rounded-full bg-source" />
                  {f.metric}
                  <Cite ids={f.refs} />
                </p>
              </Reveal>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
