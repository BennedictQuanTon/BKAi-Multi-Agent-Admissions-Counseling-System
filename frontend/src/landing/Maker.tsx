import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { ArrowUpRight, Award, BadgeCheck, Trophy } from "lucide-react";
import { useRef } from "react";
import { MAKER } from "./content";
import { EASE, MaskHeading, Reveal } from "./motion";

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
          className="relative aspect-[4/5] overflow-hidden rounded-[28px] bg-lp-board"
          initial={reduce ? false : { clipPath: "inset(14% 10% 14% 10% round 28px)" }}
          whileInView={{ clipPath: "inset(0% 0% 0% 0% round 28px)" }}
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
        </motion.div>

        <div>
          <MaskHeading id="maker-heading" className="h2" lines={[`Hi, I'm ${MAKER.name}.`, `Friends call me ${MAKER.alias}.`]} />
          <Reveal delay={0.1}>
            <p className="mt-3 text-[15px] font-medium text-lp-quiet">{MAKER.role}</p>
          </Reveal>
          {MAKER.bio.map((p, i) => (
            <Reveal key={i} delay={0.15 + i * 0.08}>
              <p className="mt-5 text-[18px] leading-[1.55] text-lp-copy">{p}</p>
            </Reveal>
          ))}
          <dl className="mt-8 divide-y divide-lp-hairline border-y border-lp-hairline">
            {MAKER.credentials.map((c, i) => (
              <Reveal key={c.k} delay={0.1 + i * 0.06} className="grid grid-cols-[96px_1fr] gap-4 py-3.5 text-[15px]">
                <dt className="text-lp-quiet">{c.k}</dt>
                <dd>{c.v}</dd>
              </Reveal>
            ))}
          </dl>
          <ul className="mt-6 grid gap-3 sm:grid-cols-3">
            {MAKER.awards.map((a, i) => (
              <Reveal as="li" key={a.title} delay={0.15 + i * 0.07} className="rounded-[18px] bg-lp-cloud p-4">
                {i === 0 ? <Trophy size={18} className="text-lp-source" /> : i === 1 ? <BadgeCheck size={18} className="text-lp-source" /> : <Award size={18} className="text-lp-source" />}
                <p className="mt-3 text-[15px] font-semibold leading-tight">{a.title}</p>
                <p className="mt-1 text-[13px] leading-snug text-lp-copy">{a.event}</p>
                <p className="mt-0.5 text-[12px] text-lp-quiet">{a.by}</p>
              </Reveal>
            ))}
          </ul>
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
