import { ArrowUpRight, Quote } from "lucide-react";
import { Link } from "react-router-dom";
import { MAKER, NAV, REPO, TESTIMONIALS } from "./content";
import { MaskHeading, Reveal } from "./motion";
import { Lockup, Mark } from "./Brand";

export function Testimonials() {
  return (
    <section className="section bg-lp-cloud" aria-labelledby="voices-heading">
      <div className="container-l">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-[640px]">
            <Reveal>
              <p className="eyebrow">Early feedback</p>
            </Reveal>
            <MaskHeading id="voices-heading" className="h2 mt-4" lines={["What testers tell us."]} />
          </div>
          <Reveal>
            {/* These are layout samples. Replace them with real quotes (with permission) after the pilot. */}
            <span className="badge !font-medium !text-lp-quiet">Sample quotes · placeholders until the pilot ends</span>
          </Reveal>
        </div>
        <ul className="mt-12 columns-1 gap-4 md:columns-2 lg:columns-4">
          {TESTIMONIALS.map((t, i) => (
            <Reveal as="li" key={i} delay={i * 0.08} className="mb-4 break-inside-avoid rounded-[12px] bg-lp-canvas p-6 shadow-[0_0_0_1px_var(--color-lp-hairline)]">
              <Quote size={18} className="text-lp-source" />
              <p className="mt-3 text-[16px] leading-[1.6] text-lp-ink">{t.quote}</p>
              <p className="mt-5 text-[14px] font-semibold">{t.who}</p>
              <p className="text-[13px] text-lp-quiet">{t.where} · sample</p>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function Closing() {
  return (
    <section className="section text-center" aria-labelledby="closing-heading">
      <div className="container-l">
        <Reveal className="flex justify-center">
          <Mark size={56} animated />
        </Reveal>
        <MaskHeading id="closing-heading" as="h2" className="display mx-auto mt-8 max-w-[760px]" lines={["Every number", "has a source."]} />
        <Reveal delay={0.15}>
          <p className="lead mx-auto mt-5 max-w-[560px]">Ask your first admissions question now. No account, nothing to install.</p>
        </Reveal>
        <Reveal delay={0.25} className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link to="/chat" className="pill-blue !px-7 !py-3 !text-[17px]">
            Try it
          </Link>
          <a href={REPO} target="_blank" rel="noreferrer" className="pill-light">
            Source on GitHub <ArrowUpRight size={16} />
          </a>
        </Reveal>
      </div>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-lp-hairline">
      <div className="container-l grid gap-10 py-14 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <Lockup />
          <p className="mt-4 max-w-[360px] text-[14px] leading-[1.6] text-lp-quiet">
            Multi-agent admissions counseling for Ho Chi Minh City University of Technology. An independent student project, not affiliated with or endorsed by
            HCMUT. Admissions data comes from the public pages at hcmut.edu.vn.
          </p>
        </div>
        <nav aria-label="Footer">
          <p className="text-[13px] font-semibold">Explore</p>
          <ul className="mt-3 space-y-2 text-[14px] text-lp-quiet">
            {NAV.map((n) => (
              <li key={n.href}>
                <a href={n.href} className="hover:text-lp-ink">
                  {n.label}
                </a>
              </li>
            ))}
            <li>
              <a href="#references" className="hover:text-lp-ink">
                References
              </a>
            </li>
          </ul>
        </nav>
        <div>
          <p className="text-[13px] font-semibold">Made by {MAKER.name}</p>
          <ul className="mt-3 space-y-2 text-[14px] text-lp-quiet">
            {MAKER.links.map((l) => (
              <li key={l.label}>
                <a href={l.href} target={l.href.startsWith("http") ? "_blank" : undefined} rel="noreferrer" className="hover:text-lp-ink">
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
          <p className="mt-6 text-[12px] leading-[1.6] text-lp-ash">
            Film voice: Kokoro-82M (Apache-2.0), generated locally. Music and sound synthesized in code. Product names belong to their owners.
          </p>
        </div>
      </div>
      <div className="container-l flex flex-wrap items-center justify-between gap-2 border-t border-lp-hairline py-5 text-[12px] text-lp-ash">
        <span>© 2026 Long Quan Ton · BKAi v5.0.0</span>
        <span>Typeset in Instrument Sans and Inter</span>
      </div>
    </footer>
  );
}
