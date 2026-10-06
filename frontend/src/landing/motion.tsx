import { animate, motion, useInView, useReducedMotion, type HTMLMotionProps } from "framer-motion";
import { useEffect, useRef, useState, type ElementType, type ReactNode } from "react";

export const EASE = [0.16, 1, 0.3, 1] as const; // expo-out: fast start, long settle

/** Fade, rise and un-blur once when scrolled into view. */
export function Reveal({
  children,
  delay = 0,
  y = 24,
  className,
  as = "div",
  ...rest
}: { children: ReactNode; delay?: number; y?: number; className?: string; as?: "div" | "li" | "section" | "article" } & Omit<HTMLMotionProps<"div">, "children">) {
  const reduce = useReducedMotion();
  const M = motion[as] as typeof motion.div;
  return (
    <M
      className={className}
      initial={reduce ? false : { opacity: 0, y, filter: "blur(8px)" }}
      whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      viewport={{ once: true, margin: "0px 0px -12% 0px" }}
      transition={{ duration: 0.9, ease: EASE, delay }}
      {...rest}
    >
      {children}
    </M>
  );
}

/** Headline whose lines slide up from behind a mask, word by word. */
export function MaskHeading({
  lines,
  as: Tag = "h2",
  className = "h2",
  delay = 0,
  id,
  animateOnMount = false,
}: {
  lines: ReactNode[];
  as?: ElementType;
  className?: string;
  delay?: number;
  id?: string;
  animateOnMount?: boolean;
}) {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { once: true, margin: "0px 0px -10% 0px" });
  const reduce = useReducedMotion();
  const show = animateOnMount || inView;
  let word = 0;
  return (
    <Tag ref={ref} id={id} className={className}>
      {lines.map((line, li) => (
        <span key={li} className="block">
          {(typeof line === "string" ? line.split(" ") : [line]).map((w, wi, arr) => {
            const i = word++;
            return (
              <span key={wi} className="inline-block overflow-hidden pb-[0.08em] align-bottom">
                <motion.span
                  className="inline-block"
                  initial={reduce ? false : { y: "105%", opacity: 0, filter: "blur(6px)" }}
                  animate={show ? { y: "0%", opacity: 1, filter: "blur(0px)" } : undefined}
                  transition={{ duration: 1, ease: EASE, delay: delay + i * 0.055 }}
                >
                  {w}
                  {wi < arr.length - 1 ? " " : ""}
                </motion.span>
              </span>
            );
          })}
        </span>
      ))}
    </Tag>
  );
}

/** Counts up to a number once visible; keeps the formatting of the target string (e.g. "40 / 40", "1.8 s"). */
export function CountUp({ value, className }: { value: string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const reduce = useReducedMotion();
  const m = value.match(/\d+(?:[.,]\d+)?/);
  const [text, setText] = useState(reduce || !m ? value : value.replace(m[0], m[0].replace(/\d/g, "0")));
  useEffect(() => {
    if (!inView || reduce || !m) return;
    const target = parseFloat(m[0].replace(",", ""));
    const decimals = (m[0].split(".")[1] || "").length;
    const c = animate(0, target, {
      duration: 1.4,
      ease: EASE,
      onUpdate: (v) => setText(value.replace(m[0], v.toFixed(decimals))),
    });
    return () => c.stop();
  }, [inView]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <span ref={ref} className={`tnum ${className ?? ""}`}>
      {text}
    </span>
  );
}

/** Superscript citation that jumps to the reference list. */
export function Cite({ ids }: { ids: number[] }) {
  return (
    <>
      {ids.map((id) => (
        <a key={id} href={`#ref-${id}`} className="ref" aria-label={`Reference ${id}`}>
          [{id}]
        </a>
      ))}
    </>
  );
}
