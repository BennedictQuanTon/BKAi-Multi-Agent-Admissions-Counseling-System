import { AnimatePresence, motion, useMotionValueEvent, useScroll } from "framer-motion";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import { NAV, REPO } from "../content";
import { Lockup } from "./Brand";

export default function Nav() {
  const { scrollY } = useScroll();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  useMotionValueEvent(scrollY, "change", (y) => setScrolled(y > 8));

  return (
    <header
      className={`sticky top-0 z-50 transition-[box-shadow,background-color] duration-300 ${
        scrolled ? "bg-canvas/85 shadow-[0_1px_0_rgba(0,0,0,0.06)] backdrop-blur-md" : "bg-canvas"
      }`}
    >
      <nav className="container-l flex h-[72px] items-center justify-between" aria-label="Main">
        <a href="#top" aria-label="BKAi home" className="shrink-0">
          <Lockup animated />
        </a>
        <ul className="hidden items-center gap-8 md:flex">
          {NAV.map((n) => (
            <li key={n.href}>
              <a href={n.href} className="text-[16px] text-ink/80 transition-colors hover:text-ink">
                {n.label}
              </a>
            </li>
          ))}
        </ul>
        <div className="flex items-center gap-3">
          <a href={REPO} target="_blank" rel="noreferrer" className="pill-dark !hidden !py-[7px] sm:!inline-flex">
            Get the code
          </a>
          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded-full md:hidden"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </nav>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-hairline bg-canvas md:hidden"
          >
            <ul className="container-l flex flex-col py-3">
              {NAV.map((n) => (
                <li key={n.href}>
                  <a href={n.href} onClick={() => setOpen(false)} className="block py-3 text-[17px]">
                    {n.label}
                  </a>
                </li>
              ))}
              <li className="pt-2 pb-3">
                <a href={REPO} target="_blank" rel="noreferrer" className="pill-dark">
                  Get the code
                </a>
              </li>
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
