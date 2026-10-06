import { motion, useReducedMotion } from "framer-motion";
import { EASE } from "./motion";

const TOP = "M32 5 55.4 18.5 32 32 8.6 18.5Z";
const LEFT = "M8.6 18.5 32 32v27l-12.4-7.2-9.4 5.8 2.4-9.8-4-2.3Z";
const RIGHT = "M32 32 55.4 18.5v27L32 59Z";
const SEAMS = "M32 5 55.4 18.5 32 32 8.6 18.5ZM32 32v27M32 32l23.4-13.5";
const SPARK = "M32 11.5c.6 4.1 1.6 5.1 5.7 6.1-4.1 1-5.1 2-5.7 6.1-.6-4.1-1.6-5.1-5.7-6.1 4.1-1 5.1-2 5.7-6.1Z";

/** Bách Khoa cube that speaks: three faces assemble, the chat tail lands, then the AI spark lights up. */
export function Mark({ size = 28, animated = false }: { size?: number; animated?: boolean }) {
  const reduce = useReducedMotion();
  const play = animated && !reduce;
  const face = (d: string, fill: string, from: { x: number; y: number }, delay: number) => (
    <motion.path
      d={d}
      fill={fill}
      initial={play ? { opacity: 0, x: from.x, y: from.y } : false}
      animate={{ opacity: 1, x: 0, y: 0 }}
      transition={{ duration: 0.9, ease: EASE, delay }}
    />
  );
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      {face(TOP, "#3aa0f0", { x: 0, y: -10 }, 0.05)}
      {face(LEFT, "#0d2f86", { x: -9, y: 6 }, 0.15)}
      {face(RIGHT, "#1f6fe0", { x: 9, y: 6 }, 0.25)}
      <motion.path
        d={SEAMS}
        fill="none"
        stroke="#fff"
        strokeWidth="1.6"
        strokeLinejoin="round"
        initial={play ? { opacity: 0 } : false}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.7 }}
      />
      <motion.path
        d={SPARK}
        fill="#fff"
        style={{ transformOrigin: "32px 17.6px" }}
        initial={play ? { scale: 0, rotate: -90 } : false}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 380, damping: 14, delay: 0.85 }}
      />
    </svg>
  );
}

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`font-semibold tracking-[-0.02em] ${className}`}>
      <span className="text-lp-navy">BK</span>
      <span className="text-lp-source">Ai</span>
    </span>
  );
}

export function Lockup({ size = 28, animated = false }: { size?: number; animated?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2">
      <Mark size={size} animated={animated} />
      <Wordmark className="text-[19px]" />
    </span>
  );
}
