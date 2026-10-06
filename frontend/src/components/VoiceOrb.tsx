import { motion, useAnimationFrame, useMotionValue, useSpring, useTransform } from "framer-motion";

export type VoiceState = "idle" | "listening" | "thinking" | "speaking";

/** Audio-reactive orb: `level()` returns the live RMS (0–1) of the mic or of the TTS output. */
export function VoiceOrb({ state, level }: { state: VoiceState; level: () => number }) {
  const raw = useMotionValue(0);
  const smooth = useSpring(raw, { stiffness: 260, damping: 22 });
  const scale = useTransform(smooth, [0, 1], [1, 1.35]);
  const ring1 = useTransform(smooth, [0, 1], [1.08, 1.6]);
  const ring2 = useTransform(smooth, [0, 1], [1.16, 1.9]);

  useAnimationFrame(() => {
    raw.set(state === "listening" || state === "speaking" ? Math.min(1, level() * 3.2) : 0);
  });

  return (
    <div className="relative grid h-56 w-56 place-items-center" aria-hidden>
      <motion.span style={{ scale: ring2 }} className="absolute h-36 w-36 rounded-full border border-hairline" />
      <motion.span style={{ scale: ring1 }} className="absolute h-36 w-36 rounded-full border border-warm-mist" />
      {state === "thinking" && (
        <motion.span
          className="absolute h-40 w-40 rounded-full border-2 border-transparent border-t-brand"
          animate={{ rotate: 360 }}
          transition={{ duration: 1.1, repeat: Infinity, ease: "linear" }}
        />
      )}
      <motion.span
        style={{ scale }}
        animate={{ backgroundColor: state === "idle" ? "#27251e" : "#1d5fd1" }}
        transition={{ duration: 0.4 }}
        className="h-32 w-32 rounded-full"
      />
      <motion.span
        className="absolute h-3 w-3 rounded-full bg-parchment"
        animate={{ opacity: state === "idle" ? 0.9 : 0.6, scale: state === "speaking" ? [1, 1.3, 1] : 1 }}
        transition={{ duration: 0.8, repeat: state === "speaking" ? Infinity : 0 }}
      />
    </div>
  );
}
