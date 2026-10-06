import { useReducedMotion } from "framer-motion";
import { useEffect, useRef } from "react";

/**
 * Painterly landscape behind the product window: pale sky, a low warm sun, peach clouds drifting,
 * and three soft hill bands. Drawn on canvas so it stays light (no video) and only animates on screen.
 */
export default function Atmosphere({ className = "" }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    let visible = true;
    let w = 0;
    let h = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);

    const resize = () => {
      const r = canvas.getBoundingClientRect();
      w = r.width;
      h = r.height;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const clouds = [
      { x: 0.12, y: 0.2, r: 0.32, c: "255,236,222", a: 0.85, v: 0.006 },
      { x: 0.55, y: 0.12, r: 0.26, c: "255,246,238", a: 0.9, v: 0.004 },
      { x: 0.86, y: 0.26, r: 0.3, c: "250,214,196", a: 0.6, v: 0.005 },
      { x: 0.35, y: 0.34, r: 0.22, c: "247,224,214", a: 0.55, v: 0.007 },
      { x: 0.7, y: 0.42, r: 0.2, c: "255,240,230", a: 0.5, v: 0.003 },
    ];

    const hill = (t: number, base: number, amp: number, freq: number, phase: number, fill: string) => {
      ctx.beginPath();
      ctx.moveTo(0, h);
      for (let x = 0; x <= w + 8; x += 8) {
        const u = x / w;
        const y =
          h * base +
          Math.sin(u * Math.PI * freq + phase + t * 0.02) * h * amp +
          Math.sin(u * Math.PI * freq * 2.3 + phase * 1.7) * h * amp * 0.35;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(w, h);
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.fill();
    };

    const draw = (ms: number) => {
      const t = ms / 1000;
      // sky
      const sky = ctx.createLinearGradient(0, 0, 0, h);
      sky.addColorStop(0, "#cfe1f4");
      sky.addColorStop(0.45, "#e9eef2");
      sky.addColorStop(0.72, "#fbeee2");
      sky.addColorStop(1, "#f6e3d3");
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, w, h);

      // low sun glow
      const sx = w * 0.72;
      const sy = h * 0.62;
      const sun = ctx.createRadialGradient(sx, sy, 0, sx, sy, Math.max(w, h) * 0.55);
      sun.addColorStop(0, "rgba(255,200,150,0.55)");
      sun.addColorStop(0.35, "rgba(255,214,180,0.22)");
      sun.addColorStop(1, "rgba(255,214,180,0)");
      ctx.fillStyle = sun;
      ctx.fillRect(0, 0, w, h);

      // clouds drift slowly to the right and wrap
      for (const c of clouds) {
        const cx = (((c.x + t * c.v) % 1.4) - 0.2) * w;
        const cy = c.y * h + Math.sin(t * 0.15 + c.x * 9) * h * 0.01;
        const r = c.r * Math.max(w, h * 1.6);
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        g.addColorStop(0, `rgba(${c.c},${c.a})`);
        g.addColorStop(0.55, `rgba(${c.c},${c.a * 0.35})`);
        g.addColorStop(1, `rgba(${c.c},0)`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.ellipse(cx, cy, r, r * 0.42, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      // hills, back to front
      hill(t, 0.74, 0.035, 1.4, 0.6, "rgba(196,214,190,0.75)");
      hill(t, 0.82, 0.04, 1.9, 2.1, "rgba(170,198,165,0.8)");
      hill(t, 0.9, 0.03, 2.6, 4.2, "rgba(150,184,146,0.85)");
    };

    const loop = (ms: number) => {
      if (visible) draw(ms);
      raf = requestAnimationFrame(loop);
    };

    resize();
    draw(0);
    const ro = new ResizeObserver(() => {
      resize();
      draw(performance.now());
    });
    ro.observe(canvas);
    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting));
    io.observe(canvas);
    if (!reduce) raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
    };
  }, [reduce]);

  return (
    <div className={`absolute inset-0 overflow-hidden ${className}`} aria-hidden="true">
      <canvas ref={ref} className="h-full w-full" />
      <div className="grain absolute inset-0 opacity-70 mix-blend-multiply" />
    </div>
  );
}
