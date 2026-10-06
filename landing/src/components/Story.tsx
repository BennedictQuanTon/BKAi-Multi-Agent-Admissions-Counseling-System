import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import { STORY, VERSIONS } from "../content";
import { Cite, EASE, MaskHeading, Reveal } from "../lib/motion";

const KIND = {
  claimed: { label: "claimed", cls: "text-ash" },
  audit: { label: "audited", cls: "text-[#b4542d]" },
  measured: { label: "measured", cls: "text-source" },
};

export default function Story() {
  const track = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: track, offset: ["start 85%", "end 60%"] });
  const fill = useTransform(scrollYProgress, [0, 1], [reduce ? 1 : 0, 1]);

  return (
    <section id="story" className="section bg-cloud" aria-labelledby="story-heading">
      <div className="container-l">
        <div className="max-w-[760px]">
          <Reveal>
            <p className="eyebrow">Background</p>
          </Reveal>
          <MaskHeading id="story-heading" className="h2 mt-4" lines={["One question, asked every summer:", "“What score do I need?”"]} />
          <Reveal delay={0.1}>
            <p className="lead mt-5">
              BKAi is an AI admissions counselor for Ho Chi Minh City University of Technology (HCMUT, VNU-HCM). It is an independent project, designed, built and
              evaluated by Long Quan Ton between May and October 2026.
            </p>
          </Reveal>
        </div>

        <ul className="mt-12 grid gap-4 md:grid-cols-3">
          {STORY.map((s, i) => (
            <Reveal as="li" key={s.k} delay={i * 0.1} className="feature-box flex flex-col px-[17px] py-6 md:px-6">
              <span className="text-[13px] font-medium text-quiet">
                {String(i + 1).padStart(2, "0")} · {s.k}
              </span>
              <h3 className="h3 mt-3">{s.title}</h3>
              <p className="mt-3 text-[15px] leading-[1.55] text-copy">
                {s.body}
                <Cite ids={s.refs} />
              </p>
            </Reveal>
          ))}
        </ul>

        {/* journey */}
        <div className="mt-20">
          <Reveal className="flex flex-wrap items-end justify-between gap-4">
            <h3 className="h2 !text-[28px]">Five versions in five months</h3>
            <p className="text-[14px] text-quiet">
              Latency labels: <span className={KIND.claimed.cls}>claimed</span> in that version's README ·{" "}
              <span className={KIND.audit.cls}>audited</span> by re-running · <span className={KIND.measured.cls}>measured</span> by committed benchmarks
              <Cite ids={[6]} />
            </p>
          </Reveal>

          <div ref={track} className="relative mt-10">
            {/* progress line (desktop: horizontal, mobile: vertical) */}
            <div className="absolute left-[11px] top-0 h-full w-[2px] bg-linen md:hidden" aria-hidden="true">
              <motion.div className="h-full w-full origin-top bg-ink" style={{ scaleY: fill }} />
            </div>
            <div className="absolute left-0 top-[11px] hidden h-[2px] w-full bg-linen md:block" aria-hidden="true">
              <motion.div className="h-full w-full origin-left bg-ink" style={{ scaleX: fill }} />
            </div>

            <ol className="relative grid gap-8 md:grid-cols-5 md:gap-5">
              {VERSIONS.map((v, i) => {
                const last = i === VERSIONS.length - 1;
                return (
                  <Reveal as="li" key={v.v} delay={i * 0.08} className="relative pl-10 md:pl-0 md:pt-10">
                    <motion.span
                      className={`absolute left-0 top-0 flex h-6 w-6 items-center justify-center rounded-full ${last ? "bg-ink" : "bg-canvas shadow-[0_0_0_2px_var(--color-ink)]"}`}
                      initial={reduce ? false : { scale: 0 }}
                      whileInView={{ scale: 1 }}
                      viewport={{ once: true, margin: "-20% 0px" }}
                      transition={{ type: "spring", stiffness: 380, damping: 18, delay: 0.1 + i * 0.12 }}
                    >
                      {last && <span className="h-2 w-2 rounded-full bg-source" />}
                    </motion.span>
                    <div className="flex items-baseline gap-2">
                      <span className="font-display text-[22px] font-medium tracking-[-0.02em]">{v.v}</span>
                      <span className="text-[13px] text-quiet">{v.date}</span>
                    </div>
                    <p className="mt-1 text-[16px] font-semibold">{v.title}</p>
                    <ul className="mt-2 space-y-1 text-[14px] leading-[1.45] text-copy">
                      {v.stack.map((s) => (
                        <li key={s}>{s}</li>
                      ))}
                    </ul>
                    <div className={`mt-4 rounded-[8px] px-3 py-2.5 ${last ? "bg-ink text-white" : "bg-canvas shadow-[0_0_0_1px_var(--color-hairline)]"}`}>
                      <div className={`text-[12px] font-medium ${last ? "text-white/60" : "text-quiet"}`}>
                        Answer latency · <span className={last ? "text-[#8ab8ff]" : KIND[v.latencyKind].cls}>{KIND[v.latencyKind].label}</span>
                      </div>
                      <div className="tnum mt-0.5 font-display text-[24px] font-medium tracking-[-0.02em]">{v.latency}</div>
                      <div className={`text-[12px] ${last ? "text-white/70" : "text-quiet"}`}>{v.note}</div>
                    </div>
                  </Reveal>
                );
              })}
            </ol>
          </div>
          <Reveal className="mt-8">
            <p className="text-[15px] text-copy">
              The v4 audit is where v5 began: real latency was about 5× what its README said, and the cache could answer for the wrong major. v5 was rebuilt around
              measuring first.{" "}
              <a className="link-blue" href="#metrics">
                Compare all five versions →
              </a>
            </p>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
