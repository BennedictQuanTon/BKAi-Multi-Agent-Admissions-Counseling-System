/**
 * Minimal SVG charts following the dataviz spec: one series per chart (single validated brand blue),
 * ≤24px bars with a 4px rounded data-end and square baseline, hairline solid grid, hover tooltip,
 * table view for accessibility, emphasis = highlight one / grey the rest.
 */
import { animate, motion, useInView, useMotionValue, useTransform } from "framer-motion";
import { Table2 } from "lucide-react";
import React, { useEffect, useRef, useState, type ReactNode } from "react";
import { ease } from "../lib/motion";
import { cn } from "../lib/utils";

const TEAL = "var(--color-chart)";
const MUTED = "var(--color-chart-muted)";

/** Path for a bar with a rounded data-end only (square at the baseline). */
function barPath(x: number, y: number, w: number, h: number, r: number, orient: "h" | "v") {
  if (orient === "h") {
    const rr = Math.min(r, w / 2, h / 2);
    return `M${x},${y} H${x + w - rr} Q${x + w},${y} ${x + w},${y + rr} V${y + h - rr} Q${x + w},${y + h} ${x + w - rr},${y + h} H${x} Z`;
  }
  const rr = Math.min(r, w / 2, h / 2);
  return `M${x},${y + h} V${y + rr} Q${x},${y} ${x + rr},${y} H${x + w - rr} Q${x + w},${y} ${x + w},${y + rr} V${y + h} Z`;
}

export function ChartCard({ title, subtitle, children, table }: { title: string; subtitle?: string; children: ReactNode; table?: ReactNode }) {
  const [showTable, setShowTable] = useState(false);
  return (
    <section className="rounded-cards border border-hairline bg-soft-paper p-4">
      <header className="mb-3 flex items-start gap-2">
        <div>
          <h3 className="text-body text-ink">{title}</h3>
          {subtitle && <p className="text-body-sm text-graphite">{subtitle}</p>}
        </div>
        {table && (
          <button
            onClick={() => setShowTable((s) => !s)}
            className="ml-auto flex items-center gap-1 rounded-buttons border border-hairline px-2 py-1 text-body-sm text-graphite hover:text-ink"
            aria-pressed={showTable}
          >
            <Table2 size={13} /> {showTable ? "Biểu đồ" : "Bảng"}
          </button>
        )}
      </header>
      {showTable ? table : children}
    </section>
  );
}

function Tooltip({ x, y, value, label }: { x: number; y: number; value: string; label: string }) {
  return (
    <div
      className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-buttons border border-hairline bg-soft-paper px-2 py-1 shadow-subtle"
      style={{ left: x, top: y - 6 }}
    >
      <div className="tabular text-body-sm font-medium text-ink">{value}</div>
      <div className="text-caption text-graphite">{label}</div>
    </div>
  );
}

export function BarList({
  data,
  format = (v) => v.toFixed(2),
  highlight,
  max,
}: {
  data: { label: string; value: number; note?: string }[];
  format?: (v: number) => string;
  highlight?: string;
  max?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true });
  const [hover, setHover] = useState<number | null>(null);
  const top = max ?? Math.max(...data.map((d) => d.value), 1);
  return (
    <div ref={ref} className="relative">
      {!data.length && <p className="py-8 text-center text-body-sm text-graphite">Chưa có dữ liệu.</p>}
      <div className={cn("relative", !data.length && "hidden")}>
        {/* hairline vertical grid (solid, recessive) */}
        <div className="pointer-events-none absolute inset-y-0 left-[40%] right-14">
          {[0, 0.25, 0.5, 0.75, 1].map((t) => (
            <span key={t} className="absolute inset-y-0 w-px bg-hairline" style={{ left: `${t * 100}%` }} />
          ))}
        </div>
        {data.map((d, i) => {
          const muted = highlight !== undefined && d.label !== highlight;
          return (
            <div
              key={d.label}
              className="relative flex h-7 items-center"
              onPointerEnter={() => setHover(i)}
              onPointerLeave={() => setHover(null)}
              tabIndex={0}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
            >
              <span className="w-[40%] shrink-0 truncate pr-3 text-right text-body-sm text-ink" title={d.label}>{d.label}</span>
              <span className="relative mr-14 flex h-3.5 flex-1 items-center">
                <motion.span
                  className="block h-3.5 rounded-r-[4px]"
                  style={{ background: muted ? MUTED : TEAL, originX: 0, width: `${Math.max(0.5, (d.value / top) * 100)}%` }}
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: inView ? 1 : 0, opacity: hover === null || hover === i ? 1 : 0.55 }}
                  transition={{ duration: 0.6, ease, delay: i * 0.03 }}
                />
                <span className="tabular absolute pl-1.5 text-body-sm text-graphite" style={{ left: `${(d.value / top) * 100}%` }}>
                  {format(d.value)}
                </span>
              </span>
              {hover === i && d.note && (
                <span className="pointer-events-none absolute left-[40%] top-7 z-10 rounded-buttons border border-hairline bg-soft-paper px-2 py-1 shadow-subtle">
                  <span className="tabular block text-body-sm font-medium text-ink">{format(d.value)}</span>
                  <span className="block text-caption text-graphite">{d.note}</span>
                </span>
              )}
            </div>
          );
        })}
      </div>
      <div className="relative ml-[40%] mr-14 mt-1 h-4">
        {[0, 0.5, 1].map((t) => (
          <span key={t} className="tabular absolute -translate-x-1/2 text-caption text-ash" style={{ left: `${t * 100}%` }}>
            {format(t * top)}
          </span>
        ))}
      </div>
    </div>
  );
}

export function Histogram({ values, binSize, unit }: { values: number[]; binSize: number; unit: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true });
  const [hover, setHover] = useState<number | null>(null);
  if (!values.length) return <div ref={ref}><p className="py-8 text-center text-body-sm text-graphite">Chưa có dữ liệu.</p></div>;
  const nb = Math.min(14, Math.max(4, Math.ceil(Math.max(...values) / binSize) + 1));
  const bins = Array.from({ length: nb }, (_, i) => values.filter((v) => v >= i * binSize && (v < (i + 1) * binSize || i === nb - 1)).length);
  const top = Math.max(...bins, 1);
  const W = 640, H = 180, padL = 28, padB = 22;
  const slot = (W - padL) / nb;
  const bw = Math.min(24, slot - 2);
  return (
    <div ref={ref} className="relative">
      <svg viewBox={`0 -10 ${W} ${H + padB + 10}`} className="w-full" role="img">
        {[0, 0.5, 1].map((t) => (
          <g key={t}>
            <line x1={padL} x2={W} y1={H - t * H} y2={H - t * H} stroke="var(--color-hairline)" strokeWidth={1} />
            <text x={padL - 6} y={H - t * H + 3} textAnchor="end" className="fill-[var(--color-ash)] text-[10px] tabular">{Math.round(t * top)}</text>
          </g>
        ))}
        {bins.map((c, i) => {
          const h = (c / top) * (H - 6);
          const x = padL + i * slot + (slot - bw) / 2;
          return (
            <g key={i} onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(null)}>
              <rect x={padL + i * slot} y={0} width={slot} height={H} fill="transparent" />
              {c > 0 && (
                <motion.path
                  d={barPath(x, H - h, bw, h, 4, "v")}
                  fill={TEAL}
                  initial={{ scaleY: 0 }}
                  animate={{ scaleY: inView ? 1 : 0 }}
                  style={{ originY: `${H}px` }}
                  transition={{ duration: 0.5, ease, delay: i * 0.025 }}
                  opacity={hover === null || hover === i ? 1 : 0.55}
                />
              )}
              <text x={padL + i * slot + slot / 2} y={H + 15} textAnchor="middle" className="fill-[var(--color-ash)] text-[10px] tabular">
                {i * binSize}
              </text>
            </g>
          );
        })}
      </svg>
      {hover !== null && (
        <Tooltip
          x={((padL + hover * slot + slot / 2) / W) * (ref.current?.clientWidth ?? W)}
          y={((H - (bins[hover] / top) * (H - 6)) / W) * (ref.current?.clientWidth ?? W)}
          value={`${bins[hover]} câu hỏi`}
          label={`${hover * binSize}–${(hover + 1) * binSize} ${unit}`}
        />
      )}
    </div>
  );
}

export function CountUp({ value, format }: { value: number; format: (v: number) => string }) {
  const mv = useMotionValue(0);
  const text = useTransform(mv, (v) => format(v));
  useEffect(() => {
    const controls = animate(mv, value, { duration: 0.9, ease });
    return controls.stop;
  }, [value, mv]);
  return <motion.span>{text}</motion.span>;
}

export function StatTile({ label, value, format, hint }: { label: string; value: number | null; format: (v: number) => string; hint?: string }) {
  return (
    <div className="rounded-cards border border-hairline bg-soft-paper p-4">
      <div className="text-body-sm text-graphite">{label}</div>
      <div className="mt-1 text-[26px] font-medium leading-tight text-ink">
        {value === null || Number.isNaN(value) ? "—" : <CountUp value={value} format={format} />}
      </div>
      {hint && <div className="mt-0.5 text-caption text-ash">{hint}</div>}
    </div>
  );
}

/* ── Line chart: one series, crosshair + tooltip, end-dot, hairline grid (dataviz spec) ── */
function useWidth(ref: React.RefObject<HTMLDivElement | null>, fallback = 600) {
  const [w, setW] = useState(fallback);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(200, e.contentRect.width)));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, [ref]);
  return w;
}

export function LineChart({
  points,
  format,
  height = 150,
  yMax,
}: {
  points: { x: number; y: number | null; label: string }[];
  format: (v: number) => string;
  height?: number;
  yMax?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const W = useWidth(ref);
  const [hover, setHover] = useState<number | null>(null);
  const data = points.filter((p) => p.y !== null && p.y !== undefined) as { x: number; y: number; label: string }[];
  const padL = 44, padR = 12, padT = 10, padB = 18;
  const H = height;
  if (!data.length) return <div ref={ref}><p className="py-10 text-center text-body-sm text-graphite">Chưa có dữ liệu.</p></div>;
  const top = yMax ?? (Math.max(...data.map((d) => d.y)) * 1.1 || 1);
  const x = (i: number) => padL + (data.length === 1 ? (W - padL - padR) / 2 : (i / (data.length - 1)) * (W - padL - padR));
  const y = (v: number) => padT + (1 - v / top) * (H - padT - padB);
  const d = data.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.y).toFixed(1)}`).join(" ");
  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
    const px = e.clientX - r.left;
    let best = 0;
    data.forEach((_, i) => { if (Math.abs(x(i) - px) < Math.abs(x(best) - px)) best = i; });
    setHover(best);
  };
  const last = data[data.length - 1];
  return (
    <div ref={ref} className="relative">
      <svg width={W} height={H} onPointerMove={onMove} onPointerLeave={() => setHover(null)} role="img">
        {[0, 0.5, 1].map((t) => (
          <g key={t}>
            <line x1={padL} x2={W - padR} y1={y(t * top)} y2={y(t * top)} stroke="var(--color-hairline)" strokeWidth={1} />
            <text x={padL - 6} y={y(t * top) + 3} textAnchor="end" className="fill-[var(--color-ash)] text-[10px] tabular">{format(t * top)}</text>
          </g>
        ))}
        <path d={`${d} L${x(data.length - 1)},${y(0)} L${x(0)},${y(0)} Z`} fill={TEAL} opacity={0.08} />
        <motion.path d={d} fill="none" stroke={TEAL} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round"
          initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.8, ease }} />
        <circle cx={x(data.length - 1)} cy={y(last.y)} r={4} fill={TEAL} stroke="var(--color-soft-paper)" strokeWidth={2} />
        <text x={x(data.length - 1) - 6} y={y(last.y) - 8} textAnchor="end" className="fill-[var(--color-ink)] text-[11px] tabular">{format(last.y)}</text>
        {hover !== null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={padT} y2={H - padB} stroke="var(--color-warm-mist)" strokeWidth={1} />
            <circle cx={x(hover)} cy={y(data[hover].y)} r={4.5} fill={TEAL} stroke="var(--color-soft-paper)" strokeWidth={2} />
          </g>
        )}
        <text x={padL} y={H - 4} className="fill-[var(--color-ash)] text-[10px]">cũ hơn</text>
        <text x={W - padR} y={H - 4} textAnchor="end" className="fill-[var(--color-ash)] text-[10px]">mới nhất</text>
      </svg>
      {hover !== null && (
        <div className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-buttons border border-hairline bg-soft-paper px-2 py-1 shadow-subtle"
          style={{ left: x(hover), top: y(data[hover].y) - 8 }}>
          <div className="tabular text-body-sm font-medium text-ink">{format(data[hover].y)}</div>
          <div className="max-w-56 truncate text-caption text-graphite">{data[hover].label}</div>
        </div>
      )}
    </div>
  );
}

/* ── Donut: part-to-whole, ≤ 3 status slices, icon + label legend (never colour alone) ── */
export function Donut({ slices, center }: { slices: { label: string; value: number; color: string; icon: string }[]; center: string }) {
  const total = slices.reduce((s, x) => s + x.value, 0);
  const R = 52, C = 2 * Math.PI * R;
  let acc = 0;
  return (
    <div className="flex items-center gap-5">
      <svg width={132} height={132} viewBox="0 0 132 132" role="img">
        <circle cx={66} cy={66} r={R} fill="none" stroke="var(--color-hairline)" strokeWidth={14} />
        {total > 0 && slices.map((s) => {
          const len = (s.value / total) * C;
          const gap = slices.filter((x) => x.value > 0).length > 1 ? 2 : 0;
          const el = (
            <motion.circle key={s.label} cx={66} cy={66} r={R} fill="none" stroke={s.color} strokeWidth={14}
              strokeDasharray={`${Math.max(len - gap, 0)} ${C}`} strokeDashoffset={-acc} transform="rotate(-90 66 66)"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }} />
          );
          acc += len;
          return el;
        })}
        <text x={66} y={64} textAnchor="middle" className="fill-[var(--color-ink)] text-[20px] font-medium tabular">{center}</text>
        <text x={66} y={82} textAnchor="middle" className="fill-[var(--color-graphite)] text-[10px]">{total} câu</text>
      </svg>
      <ul className="space-y-1.5 text-body-sm">
        {slices.map((s) => (
          <li key={s.label} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: s.color }} />
            <span className="text-ink">{s.icon} {s.label}</span>
            <span className="tabular text-graphite">{s.value} · {total ? Math.round((s.value / total) * 100) : 0}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ── Waterfall: one request's stages on a shared time axis ── */
export type Span = { label: string; sub?: string; start: number; end: number; mark?: number; kind: string };

export function Waterfall({ spans, total }: { spans: Span[]; total: number }) {
  const T = Math.max(total, ...spans.map((s) => s.end), 1);
  return (
    <div className="space-y-1">
      {spans.map((s, i) => {
        const left = (s.start / T) * 100;
        const width = Math.max(((s.end - s.start) / T) * 100, 0.4);
        return (
          <div key={i} className="grid grid-cols-[210px_1fr_70px] items-center gap-3 text-body-sm">
            <div className="truncate text-ink" title={s.sub}>{s.label}{s.sub && <span className="text-ash"> · {s.sub}</span>}</div>
            <div className="relative h-4 rounded-[3px] bg-parchment">
              <motion.div className="absolute top-0.5 h-3 rounded-r-[3px]"
                style={{ left: `${left}%`, width: `${width}%`, background: s.kind === "llm" ? TEAL : s.kind === "retrieval" ? "#0b7f87" : "var(--color-graphite)", originX: 0 }}
                initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 0.4, ease, delay: i * 0.03 }} />
              {s.mark !== undefined && (
                <span className="absolute top-0 h-4 w-px bg-ink" style={{ left: `${(s.mark / T) * 100}%` }} title="first token" />
              )}
            </div>
            <div className="tabular text-right text-graphite">{(s.end - s.start).toFixed(0)} ms</div>
          </div>
        );
      })}
      <div className="grid grid-cols-[210px_1fr_70px] gap-3 text-caption text-ash">
        <span />
        <div className="flex justify-between tabular"><span>0</span><span>{(T / 2000).toFixed(2)} s</span><span>{(T / 1000).toFixed(2)} s</span></div>
        <span />
      </div>
    </div>
  );
}
