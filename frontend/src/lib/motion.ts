import type { Transition, Variants } from "framer-motion";

/** One spring for the whole product — calm, quick, no bounce. */
export const spring: Transition = { type: "spring", stiffness: 380, damping: 34, mass: 0.8 };
export const softSpring: Transition = { type: "spring", stiffness: 220, damping: 30 };
export const ease = [0.2, 0.8, 0.2, 1] as const;

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.32, ease } },
};

export const stagger = (step = 0.04, delay = 0): Variants => ({
  hidden: {},
  show: { transition: { staggerChildren: step, delayChildren: delay } },
});

export const page: Variants = {
  hidden: { opacity: 0, y: 6 },
  show: { opacity: 1, y: 0, transition: { duration: 0.28, ease } },
  exit: { opacity: 0, y: -4, transition: { duration: 0.16, ease } },
};
