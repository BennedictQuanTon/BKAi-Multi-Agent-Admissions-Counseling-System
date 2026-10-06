import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import { useRef } from "react";
import { MAKER } from "../content";
import { EASE, MaskHeading, Reveal } from "../lib/motion";

export default function Maker() {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const imgY = useTransform(scrollYProgress, [0, 1], reduce ? ["0%", "0%"] : ["-6%", "6%"]);

  return (
    <section id="maker" className="section" aria-labelledby="maker-heading">
      <div className="container-l grid items-center gap-12 md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] md:gap-16">
        <motion.div
          ref={ref}
          className="relative aspect-[4/5] overflow-hidden rounded-[12px] bg-board"
          initial={reduce ? false : { clipPath: "inset(18% 12% 18% 12% round 12px)" }}
          whileInView={{ clipPath: "inset(0% 0% 0% 0% round 12px)" }}
          viewport={{ once: true, margin: "-15% 0px" }}
          transition={{ duration: 1.4, ease: EASE }}
        >
          <motion.img
            src="/media/maker.jpg"
            alt="Portrait of Long Quan Ton"
            className="absolute inset-0 h-[112%] w-full object-cover object-[50%_30%]"
            style={{ y: imgY, top: "-6%" }}
            loading="lazy"
          />
          <div className="absolute bottom-4 left-4 flex items-center gap-2 rounded-full bg-canvas/90 px-3 py-1.5 text-[12px] font-medium backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-source" /> Designer, engineer, evaluator
          </div>
        </motion.div>

        <div>
          <Reveal>
            <p className="eyebrow">The maker</p>
          </Reveal>
          <MaskHeading id="maker-heading" className="h2 mt-4" lines={[`Hi, I'm ${MAKER.name}.`, `Friends call me ${MAKER.alias}.`]} />
          <Reveal delay={0.1}>
            <p className="mt-3 text-[15px] font-medium text-quiet">{MAKER.role}</p>
          </Reveal>
          {MAKER.bio.map((p, i) => (
            <Reveal key={i} delay={0.15 + i * 0.08}>
              <p className="lead mt-5">{p}</p>
            </Reveal>
          ))}
          <dl className="mt-8 divide-y divide-hairline border-y border-hairline">
            {MAKER.credentials.map((c, i) => (
              <Reveal key={c.k} delay={0.1 + i * 0.06} className="grid grid-cols-[96px_1fr] gap-4 py-3.5 text-[15px]">
                <dt className="text-quiet">{c.k}</dt>
                <dd>{c.v}</dd>
              </Reveal>
            ))}
          </dl>
          <Reveal delay={0.2} className="mt-7 flex flex-wrap gap-3">
            {MAKER.links.map((l, i) => (
              <a key={l.label} href={l.href} target={l.href.startsWith("http") ? "_blank" : undefined} rel="noreferrer" className={i === 0 ? "pill-dark" : "pill-light"}>
                {l.label} <ArrowUpRight size={15} />
              </a>
            ))}
          </Reveal>
        </div>
      </div>
    </section>
  );
}
