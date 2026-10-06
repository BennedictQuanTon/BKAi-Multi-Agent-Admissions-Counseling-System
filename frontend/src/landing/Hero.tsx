import { AnimatePresence, motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { useRef, useState } from "react";
import { EASE, MaskHeading } from "./motion";
import { ProofStrip, StackMarquee } from "./Proof";
import Atmosphere from "./Atmosphere";
import LiveDemo from "./LiveDemo";

const MODES = [
  {
    key: "students",
    label: "For students",
    sub: "BKAi is a multi-agent AI counselor for Ho Chi Minh City University of Technology. Ask in Vietnamese, by chat or by voice, and get the official number with the page it came from.",
  },
  {
    key: "teams",
    label: "For admissions teams",
    sub: "Every answer is traced live: which agent ran, which page it read, how long Gemini took, and whether every number matched the source.",
  },
] as const;

export default function Hero() {
  const [mode, setMode] = useState<(typeof MODES)[number]["key"]>("students");
  const stage = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: stage, offset: ["start end", "end start"] });
  // The window starts tilted back and settles flat as it scrolls into place.
  const rotateX = useTransform(scrollYProgress, [0.1, 0.45], [reduce ? 0 : 14, 0]);
  const scale = useTransform(scrollYProgress, [0.1, 0.45], [reduce ? 1 : 0.94, 1]);
  const skyY = useTransform(scrollYProgress, [0, 1], ["-6%", "6%"]);
  const current = MODES.find((m) => m.key === mode)!;

  return (
    <section id="top" className="relative overflow-hidden pt-10 md:pt-16">
      <div className="container-l text-center">
        {/* mode switcher */}
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: EASE }}
          role="tablist"
          aria-label="Audience"
          className="mx-auto inline-flex rounded-full bg-lp-cloud p-1"
        >
          {MODES.map((m) => (
            <button
              key={m.key}
              role="tab"
              aria-selected={mode === m.key}
              onClick={() => setMode(m.key)}
              className={`relative rounded-full px-3.5 py-2 text-[13px] font-medium leading-none transition-colors ${mode === m.key ? "text-lp-ink" : "text-lp-quiet hover:text-lp-ink"}`}
            >
              {mode === m.key && (
                <motion.span layoutId="mode-pill" className="absolute inset-0 rounded-full bg-lp-canvas shadow-[var(--shadow-pill)]" transition={{ type: "spring", stiffness: 500, damping: 38 }} />
              )}
              <span className="relative">{m.label}</span>
            </button>
          ))}
        </motion.div>

        <MaskHeading as="h1" className="display mx-auto mt-7 max-w-[900px]" lines={["Admissions answers,", "grounded in the source."]} delay={0.15} animateOnMount />

        <div className="mx-auto mt-6 min-h-[81px] max-w-[640px]">
          <AnimatePresence mode="wait">
            <motion.p
              key={current.key}
              className="lead"
              initial={reduce ? false : { opacity: 0, y: 8, filter: "blur(4px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: -6, filter: "blur(4px)" }}
              transition={{ duration: 0.5, ease: EASE }}
            >
              {current.sub}
            </motion.p>
          </AnimatePresence>
        </div>

        <motion.div
          initial={reduce ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease: EASE, delay: 0.55 }}
          className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-4"
        >
          <Link to="/chat" className="pill-blue !px-7 !py-3 !text-[17px]">
            Try it
          </Link>
          <a href="#metrics" className="link-blue group inline-flex items-center gap-1.5 text-[16px]">
            See the numbers <ArrowRight size={16} className="transition-transform duration-300 group-hover:translate-x-1" />
          </a>
        </motion.div>
      </div>

      {/* product preview over a painterly field */}
      <div ref={stage} className="container-l mt-14 md:mt-16" style={{ perspective: 1800 }}>
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 60 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.4, ease: EASE, delay: 0.5 }}
          className="relative overflow-hidden rounded-[20px] px-[3%] pt-[5%] pb-[4%] md:px-[6%]"
        >
          <motion.div className="absolute inset-[-8%]" style={{ y: skyY }}>
            <Atmosphere />
          </motion.div>
          <motion.div
            style={{ rotateX, scale, transformOrigin: "50% 100%" }}
            className="relative mx-auto overflow-hidden rounded-[12px] bg-lp-canvas shadow-[var(--shadow-overlay)]"
          >
            {/* window chrome */}
            <div className="flex h-9 items-center gap-2 border-b border-black/[0.06] bg-lp-canvas px-3.5">
              <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
              <span className="mx-auto rounded-md bg-lp-cloud px-3 py-0.5 text-[11px] text-lp-quiet">bkai · {mode === "students" ? "Hỏi đáp" : "Observability"}</span>
              <span className="w-10" />
            </div>
            <div className="relative aspect-[1512/900] max-md:aspect-[4/5]">
              <AnimatePresence mode="wait" initial={false}>
                {mode === "students" ? (
                  <motion.div key="chat" className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.35 }}>
                    <LiveDemo />
                  </motion.div>
                ) : (
                  <motion.img
                    key="obs"
                    src="/media/ui/observability.jpg"
                    alt="BKAi Observability: latency, time to first token, tokens, confidence and component health"
                    className="absolute inset-0 h-full w-full object-cover object-top"
                    initial={{ opacity: 0, scale: 1.02 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.6, ease: EASE }}
                  />
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </motion.div>
        <p className="mt-4 text-center text-[13px] text-lp-quiet">
          {mode === "students" ? "A real answer, replayed. Numbers are the official 2026 cut-offs." : "The live Observability panel, captured from the running system."}
        </p>
      </div>

      {/* proof + stack */}
      <div className="container-l mt-16">
        <ProofStrip />
      </div>
      <div className="mt-16">
        <StackMarquee />
      </div>
    </section>
  );
}
