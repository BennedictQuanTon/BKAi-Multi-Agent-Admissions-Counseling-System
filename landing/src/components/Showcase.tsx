import { AnimatePresence, motion, useInView, useReducedMotion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { SLIDES } from "../content";
import { EASE, MaskHeading, Reveal } from "../lib/motion";
import { IPhonePro, MacBookPro } from "./Devices";

const DWELL = 8000;

export default function Showcase() {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const root = useRef<HTMLElement>(null);
  const inView = useInView(root, { margin: "-25% 0px" });
  const reduce = useReducedMotion();
  const slide = SLIDES[index];

  const go = useCallback((i: number) => {
    setIndex((i + SLIDES.length) % SLIDES.length);
    setProgress(0);
  }, []);

  // auto-advance while visible and not hovered
  useEffect(() => {
    if (!inView || paused || reduce) return;
    let raf = 0;
    const start = performance.now() - progress * DWELL;
    const tick = (now: number) => {
      const p = (now - start) / DWELL;
      if (p >= 1) {
        go(index + 1);
        return;
      }
      setProgress(p);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, paused, index, reduce, go]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <section ref={root} id="product" className="section overflow-hidden" aria-labelledby="product-heading">
      <div className="container-l">
        <div className="mx-auto max-w-[760px] text-center">
          <Reveal>
            <p className="eyebrow">The product</p>
          </Reveal>
          <MaskHeading id="product-heading" className="h2 mt-4" lines={["One counselor, six views."]} />
          <Reveal delay={0.1}>
            <p className="lead mx-auto mt-4 max-w-[600px]">Real screens from the running app, captured, not mocked. The app speaks Vietnamese; the notes are in English.</p>
          </Reveal>
        </div>

        {/* tabs */}
        <Reveal delay={0.15} className="mt-10 flex justify-center">
          <div role="tablist" aria-label="Product views" className="scroll-x flex max-w-full gap-1 rounded-full bg-cloud p-1">
            {SLIDES.map((s, i) => (
              <button
                key={s.key}
                role="tab"
                aria-selected={i === index}
                aria-controls="showcase-panel"
                onClick={() => {
                  go(i);
                  setPaused(true);
                }}
                className={`relative shrink-0 overflow-hidden rounded-full px-3.5 py-2 text-[13px] font-medium leading-none transition-colors ${i === index ? "text-ink" : "text-quiet hover:text-ink"}`}
              >
                {i === index && (
                  <motion.span layoutId="showcase-pill" className="absolute inset-0 rounded-full bg-canvas shadow-[var(--shadow-pill)]" transition={{ type: "spring", stiffness: 500, damping: 40 }} />
                )}
                <span className="relative">{s.tab}</span>
                {i === index && !paused && !reduce && (
                  <span className="absolute bottom-[3px] left-3.5 right-3.5 h-[2px] overflow-hidden rounded-full bg-black/5">
                    <span className="block h-full origin-left bg-source" style={{ transform: `scaleX(${progress})` }} />
                  </span>
                )}
              </button>
            ))}
          </div>
        </Reveal>

        <div
          id="showcase-panel"
          role="tabpanel"
          className="relative mx-auto mt-10 max-w-[980px]"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
        >
          <Reveal y={40}>
            <MacBookPro>
              <AnimatePresence initial={false}>
                <motion.div
                  key={slide.key}
                  className="absolute inset-0 overflow-hidden"
                  initial={{ opacity: 0, filter: "blur(10px)" }}
                  animate={{ opacity: 1, filter: "blur(0px)" }}
                  exit={{ opacity: 0, filter: "blur(10px)" }}
                  transition={{ duration: 0.7, ease: EASE }}
                >
                  <motion.div
                    className="absolute inset-0"
                    style={{ transformOrigin: `${slide.focus.x}% ${slide.focus.y}%` }}
                    initial={{ scale: 1 }}
                    animate={{ scale: reduce ? 1 : slide.focus.scale }}
                    transition={{ duration: DWELL / 1000, ease: [0.45, 0, 0.25, 1] }}
                  >
                    <img src={slide.image} alt={slide.alt} className="h-full w-full object-cover object-top" />
                    {slide.callouts.map((c, i) => (
                      <motion.div
                        key={c.label}
                        className="absolute"
                        style={{ left: `${c.x}%`, top: `${c.y}%` }}
                        initial={reduce ? false : { opacity: 0, scale: 0.6 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ type: "spring", stiffness: 380, damping: 22, delay: 0.7 + i * 0.55 }}
                      >
                        <span className="relative -ml-[9px] -mt-[9px] flex h-[18px] w-[18px] items-center justify-center rounded-full bg-source text-[10px] font-semibold text-white shadow-[0_0_0_3px_rgba(255,255,255,0.9)]">
                          {!reduce && <span className="absolute inset-0 animate-ping rounded-full bg-source/40" />}
                          <span className="relative">{i + 1}</span>
                        </span>
                        <span
                          className={`absolute top-1/2 hidden -translate-y-1/2 whitespace-nowrap rounded-[6px] bg-ink px-2.5 py-1.5 text-[12px] font-medium text-white shadow-[var(--shadow-float)] md:block ${
                            c.side === "left" ? "right-[18px]" : "left-[18px]"
                          }`}
                        >
                          {c.label}
                        </span>
                      </motion.div>
                    ))}
                  </motion.div>
                </motion.div>
              </AnimatePresence>
            </MacBookPro>
          </Reveal>

          {/* phone on the first view: the same app on a 390 px screen */}
          <AnimatePresence>
            {index === 0 && (
              <motion.div
                className="absolute -right-2 bottom-[6%] hidden w-[17%] lg:-right-14 lg:block"
                initial={reduce ? false : { opacity: 0, y: 40, rotate: 4 }}
                animate={{ opacity: 1, y: 0, rotate: 0 }}
                exit={{ opacity: 0, y: 30 }}
                transition={{ duration: 0.9, ease: EASE, delay: 0.3 }}
              >
                <IPhonePro statusBar={false}>
                  <img src="/media/ui/mobile.jpg" alt="BKAi on a phone" className="absolute inset-0 h-full w-full object-cover object-top" />
                </IPhonePro>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="mt-8 grid items-start gap-6 md:grid-cols-[1fr_auto]">
            <AnimatePresence mode="wait">
              <motion.div
                key={slide.key}
                initial={reduce ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.45, ease: EASE }}
              >
                <h3 className="font-display text-[24px] font-medium leading-[1.25] tracking-[-0.015em] md:text-[28px]">{slide.title}</h3>
                <p className="mt-3 max-w-[640px] text-[16px] leading-[1.6] text-copy">{slide.body}</p>
                <ol className="mt-4 space-y-1.5 md:hidden">
                  {slide.callouts.map((c, i) => (
                    <li key={c.label} className="flex items-center gap-2 text-[14px] text-copy">
                      <span className="flex h-[18px] w-[18px] items-center justify-center rounded-full bg-source text-[10px] font-semibold text-white">{i + 1}</span>
                      {c.label}
                    </li>
                  ))}
                </ol>
              </motion.div>
            </AnimatePresence>
            <div className="flex gap-2">
              <button type="button" aria-label="Previous view" onClick={() => { go(index - 1); setPaused(true); }} className="pill-light !h-11 !w-11 !justify-center !p-0">
                <ChevronLeft size={18} />
              </button>
              <button type="button" aria-label="Next view" onClick={() => { go(index + 1); setPaused(true); }} className="pill-light !h-11 !w-11 !justify-center !p-0">
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
