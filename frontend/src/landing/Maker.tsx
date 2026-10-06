import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { ArrowUpRight, Award, ChevronLeft, ChevronRight } from "lucide-react";
import { useRef } from "react";
import { CERTS, MAKER } from "./content";
import { EASE, MaskHeading, Reveal } from "./motion";

// full-bleed strip whose first card lines up with the page container
const EDGE = "max(16px, calc((100vw - 1200px) / 2 + 32px))";

function Certificates() {
  const strip = useRef<HTMLUListElement>(null);
  const scroll = (dir: number) => strip.current?.scrollBy({ left: dir * strip.current.clientWidth * 0.8, behavior: "smooth" });
  return (
    <div className="mt-20">
      <div className="container-l flex items-end justify-between gap-4">
        <div>
          <h3 className="font-[family-name:var(--font-lp-display)] text-[26px] font-medium tracking-[-0.02em]">
            {CERTS.length} certificates
          </h3>
          <p className="mt-1 text-[15px] text-lp-quiet">Hackathons, honours and coursework from NVIDIA, Google, AWS, Anthropic, Stanford Online and DeepLearning.AI.</p>
        </div>
        <div className="hidden gap-2 md:flex">
          <button type="button" aria-label="Previous certificates" onClick={() => scroll(-1)} className="pill-light !h-10 !w-10 !justify-center !p-0">
            <ChevronLeft size={18} />
          </button>
          <button type="button" aria-label="Next certificates" onClick={() => scroll(1)} className="pill-light !h-10 !w-10 !justify-center !p-0">
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
      <ul
        ref={strip}
        className="mt-6 flex snap-x snap-mandatory gap-4 overflow-x-auto pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{ paddingInline: EDGE, scrollPaddingInline: EDGE }}
      >
        {CERTS.map((c, i) => (
          <Reveal as="li" key={c.img} delay={Math.min(i, 5) * 0.05} className="w-[260px] shrink-0 snap-start md:w-[300px]">
            <div className="group">
              <div className="overflow-hidden rounded-[18px] bg-lp-cloud shadow-[0_0_0_1px_rgba(0,0,0,0.05)]">
                <img
                  src={`/media/certs/${c.img}.jpg`}
                  alt={`${c.title}, ${c.issuer}`}
                  loading="lazy"
                  className="aspect-[4/3] w-full object-cover object-top transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.04]"
                />
              </div>
              <p className="mt-3 text-[15px] font-semibold leading-snug">{c.title}</p>
              <p className="mt-0.5 text-[13px] text-lp-quiet">
                {c.issuer} · {c.date}
              </p>
              {c.verify && (
                <a href={c.verify} target="_blank" rel="noreferrer" className="link-blue mt-1 inline-flex items-center gap-0.5 text-[13px]">
                  Verify <ArrowUpRight size={12} />
                </a>
              )}
            </div>
          </Reveal>
        ))}
      </ul>
    </div>
  );
}

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
                <Award size={18} className="text-lp-source" />
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
      <Certificates />
    </section>
  );
}
