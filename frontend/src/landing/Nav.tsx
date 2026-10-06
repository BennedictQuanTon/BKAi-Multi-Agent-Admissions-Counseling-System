import { AnimatePresence, motion, useMotionValueEvent, useScroll } from "framer-motion";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { NAV } from "./content";
import { Lockup } from "./Brand";

export default function Nav() {
  const { scrollY } = useScroll();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  useMotionValueEvent(scrollY, "change", (y) => setScrolled(y > 8));

  return (
    <header
      className={`sticky top-0 z-50 transition-[box-shadow,background-color] duration-300 ${
        scrolled ? "bg-lp-canvas/85 shadow-[0_1px_0_rgba(0,0,0,0.06)] backdrop-blur-md" : "bg-lp-canvas"
      }`}
    >
      <nav className="container-l flex h-[72px] items-center justify-between" aria-label="Main">
        <a href="#top" aria-label="BKAi home" className="shrink-0">
          <Lockup animated />
        </a>
        <ul className="hidden items-center gap-8 md:flex">
          {NAV.map((n) => (
            <li key={n.href}>
              <a href={n.href} className="text-[15px] text-lp-ink/70 transition-colors hover:text-lp-ink">
                {n.label}
              </a>
            </li>
          ))}
        </ul>
        <div className="flex items-center gap-3">
          <Link to="/chat" className="pill-blue !hidden !py-[8px] !px-[18px] !text-[15px] sm:!inline-flex">
            Try it
          </Link>
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
            className="overflow-hidden border-t border-lp-hairline bg-lp-canvas md:hidden"
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
                <Link to="/chat" className="pill-blue">
                  Try it
                </Link>
              </li>
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
