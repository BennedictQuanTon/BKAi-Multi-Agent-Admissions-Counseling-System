import { motion, useReducedMotion } from "framer-motion";
import { EASE } from "../lib/motion";

/** The source dot: a citation's brackets around the one fact that matters. */
export function Mark({ size = 24, animated = false, light = false }: { size?: number; animated?: boolean; light?: boolean }) {
  const reduce = useReducedMotion();
  const play = animated && !reduce;
  const bg = light ? "#fdfcfb" : "#2e2e2e";
  const fg = light ? "#2e2e2e" : "#fdfcfb";
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="9" fill={bg} />
      <motion.path
        d="M12.4 9.2H9.4v13.6h3"
        fill="none"
        stroke={fg}
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={play ? { x: 3, opacity: 0 } : false}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.8, ease: EASE, delay: 0.15 }}
      />
      <motion.path
        d="M19.6 9.2h3v13.6h-3"
        fill="none"
        stroke={fg}
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={play ? { x: -3, opacity: 0 } : false}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.8, ease: EASE, delay: 0.15 }}
      />
      <motion.circle
        cx="16"
        cy="16"
        r="2.7"
        fill="#207dff"
        initial={play ? { scale: 0, y: -6 } : false}
        animate={{ scale: 1, y: 0 }}
        style={{ transformOrigin: "16px 16px" }}
        transition={{ type: "spring", stiffness: 420, damping: 16, delay: 0.55 }}
      />
    </svg>
  );
}

export function Lockup({ size = 24, animated = false }: { size?: number; animated?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <Mark size={size} animated={animated} />
      <span className="text-[18px] font-semibold tracking-[-0.36px]" style={{ fontSize: size * 0.75 }}>
        BKAi
      </span>
    </span>
  );
}
