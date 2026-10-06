// Device frames in CSS (ported from the Weatherise landing), so any screen content drops in.
// Proportions follow MacBook Pro 14", iPhone 16 Pro and iPad Pro 11".

import type { CSSProperties, ReactNode } from "react";

/** MacBook Pro 14": black glass bezel with notch, aluminum hinge, silver base with scoop and feet. */
export function MacBookPro({ children, className = "", style }: { children: ReactNode; className?: string; style?: CSSProperties }) {
  return (
    <div className={`relative ${className}`} style={style}>
      {/* Lid */}
      <div
        className="relative mx-auto w-[86%] rounded-[2.4%/3.6%] p-[0.22%]"
        style={{ background: "linear-gradient(180deg,#a5a7ab,#6d6f73 40%,#56585c)" }}
      >
        <div className="relative rounded-[2.2%/3.4%] bg-[#060607] px-[1.55%] pb-[2.2%] pt-[1.55%]">
          {/* Screen */}
          <div className="relative overflow-hidden rounded-t-[1.1%/1.7%] rounded-b-[0.4%/0.6%] bg-black" style={{ aspectRatio: "3024 / 1964" }}>
            {children}
            {/* glass reflection */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0"
              style={{ background: "linear-gradient(115deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.03) 32%, transparent 33%)" }}
            />
          </div>
          {/* Notch with camera */}
          <div aria-hidden="true" className="absolute left-1/2 top-0 h-[4.1%] w-[11.5%] -translate-x-1/2 rounded-b-[14%/36%] bg-[#060607]">
            <span className="absolute left-1/2 top-[38%] h-[24%] w-[3.2%] -translate-x-1/2 rounded-full bg-[#1b1d26] shadow-[inset_0_0_1px_1px_#2a3350]" />
          </div>
        </div>
      </div>
      {/* Hinge */}
      <div aria-hidden="true" className="mx-auto h-[0.55vw] max-h-[7px] min-h-[3px] w-[80%]" style={{ background: "linear-gradient(180deg,#3a3b3e,#141415)" }} />
      {/* Base */}
      <div aria-hidden="true" className="relative mx-auto">
        <div
          className="relative h-[1.25vw] max-h-[16px] min-h-[6px] w-full rounded-b-[2.2%/90%] rounded-t-[0.6%/30%]"
          style={{
            background: "linear-gradient(180deg,#f4f5f6 0%,#dadbdd 18%,#c3c5c8 55%,#9c9ea2 82%,#77797d 100%)",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.9), inset 0 -1px 1px rgba(0,0,0,0.25)",
          }}
        >
          {/* Thumb scoop */}
          <div
            className="absolute left-1/2 top-0 h-[52%] w-[15%] -translate-x-1/2 rounded-b-[18%/100%]"
            style={{ background: "linear-gradient(180deg,#9fa1a5,#c6c8cb 70%,#d9dadc)", boxShadow: "inset 0 1px 2px rgba(0,0,0,0.25)" }}
          />
        </div>
        {/* Feet */}
        <div className="absolute -bottom-[3px] left-[9%] h-[4px] w-[7%] rounded-b-full bg-[#2b2c2e]" />
        <div className="absolute -bottom-[3px] right-[9%] h-[4px] w-[7%] rounded-b-full bg-[#2b2c2e]" />
      </div>
      {/* Contact shadow */}
      <div aria-hidden="true" className="mx-auto mt-[0.4%] h-[18px] w-[92%] rounded-[50%] bg-[radial-gradient(closest-side,rgba(16,16,16,0.22),transparent)] blur-[2px]" />
    </div>
  );
}

function StatusBar({ dark = false }: { dark?: boolean }) {
  const c = dark ? "#fff" : "#101010";
  return (
    <div aria-hidden="true" className="absolute inset-x-0 top-0 z-10 flex h-[6.2%] items-center justify-between px-[9%] pt-[1.2%]">
      <span className="text-[clamp(7px,0.9vw,13px)] font-semibold" style={{ color: c }}>
        9:41
      </span>
      <span className="flex items-center gap-[4%]" style={{ width: "26%", justifyContent: "flex-end" }}>
        <svg viewBox="0 0 18 12" className="h-[0.7em] w-auto text-[clamp(7px,0.9vw,13px)]" fill={c}>
          <rect x="0" y="8" width="3" height="4" rx="1" />
          <rect x="5" y="5.5" width="3" height="6.5" rx="1" />
          <rect x="10" y="3" width="3" height="9" rx="1" />
          <rect x="15" y="0" width="3" height="12" rx="1" />
        </svg>
        <svg viewBox="0 0 16 12" className="h-[0.7em] w-auto text-[clamp(7px,0.9vw,13px)]" fill={c}>
          <path d="M8 2.2c2.3 0 4.4.9 6 2.4l1.2-1.3C13.3 1.5 10.8.4 8 .4S2.7 1.5.8 3.3L2 4.6c1.6-1.5 3.7-2.4 6-2.4zm0 3.6c1.3 0 2.5.5 3.4 1.3l1.2-1.3C11.4 4.6 9.8 4 8 4s-3.4.6-4.6 1.8l1.2 1.3c.9-.8 2.1-1.3 3.4-1.3zM8 9.4c-.5 0-1 .2-1.3.6L8 11.4l1.3-1.4c-.3-.4-.8-.6-1.3-.6z" />
        </svg>
        <svg viewBox="0 0 26 12" className="h-[0.75em] w-auto text-[clamp(7px,0.9vw,13px)]">
          <rect x="0.5" y="0.5" width="22" height="11" rx="3" fill="none" stroke={c} strokeOpacity="0.4" />
          <rect x="2" y="2" width="17" height="8" rx="1.8" fill={c} />
          <path d="M24 4v4c.8-.3 1.3-1.1 1.3-2S24.8 4.3 24 4z" fill={c} fillOpacity="0.4" />
        </svg>
      </span>
    </div>
  );
}

/** iPhone 16 Pro: titanium band, side buttons, thin black border, Dynamic Island, status bar. */
export function IPhonePro({ children, className = "", style, statusBar = true }: { children: ReactNode; className?: string; style?: CSSProperties; statusBar?: boolean }) {
  return (
    <div className={`relative ${className}`} style={style}>
      {/* side buttons */}
      <span aria-hidden="true" className="absolute -left-[1.3%] top-[17%] h-[4%] w-[1.6%] rounded-l-sm" style={{ background: "linear-gradient(90deg,#8d8e92,#d4d5d8)" }} />
      <span aria-hidden="true" className="absolute -left-[1.3%] top-[24.5%] h-[7.5%] w-[1.6%] rounded-l-sm" style={{ background: "linear-gradient(90deg,#8d8e92,#d4d5d8)" }} />
      <span aria-hidden="true" className="absolute -left-[1.3%] top-[34%] h-[7.5%] w-[1.6%] rounded-l-sm" style={{ background: "linear-gradient(90deg,#8d8e92,#d4d5d8)" }} />
      <span aria-hidden="true" className="absolute -right-[1.3%] top-[27%] h-[11%] w-[1.6%] rounded-r-sm" style={{ background: "linear-gradient(270deg,#8d8e92,#d4d5d8)" }} />
      {/* titanium band */}
      <div
        className="relative rounded-[17%/8%] p-[1.5%]"
        style={{
          background: "linear-gradient(135deg,#e3e3e5 0%,#9fa0a4 22%,#d8d8db 48%,#8e8f93 74%,#c9c9cc 100%)",
          boxShadow: "0 30px 60px rgba(16,16,16,0.22), 0 8px 16px rgba(16,16,16,0.10)",
        }}
      >
        <div className="relative rounded-[15.6%/7.3%] bg-[#050506] p-[3.2%]">
          <div className="relative overflow-hidden rounded-[13%/6%] bg-white" style={{ aspectRatio: "1179 / 2556" }}>
            {children}
            {statusBar && <StatusBar />}
            {/* Dynamic Island */}
            <div aria-hidden="true" className="absolute left-1/2 top-[1.6%] z-20 h-[3.9%] w-[31%] -translate-x-1/2 rounded-full bg-black">
              <span className="absolute right-[13%] top-1/2 h-[42%] w-[9%] -translate-y-1/2 rounded-full bg-[#141724] shadow-[inset_0_0_1px_1px_#26304d]" />
            </div>
            {/* Home indicator */}
            <div aria-hidden="true" className="absolute bottom-[1%] left-1/2 z-20 h-[0.55%] w-[36%] -translate-x-1/2 rounded-full bg-[#101010]/80" />
            <div aria-hidden="true" className="pointer-events-none absolute inset-0" style={{ background: "linear-gradient(120deg, rgba(255,255,255,0.12) 0%, transparent 30%)" }} />
          </div>
        </div>
      </div>
    </div>
  );
}

/** iPad Pro 11" (portrait): aluminum edge, uniform black bezel, front camera. */
export function IPadPro({ children, className = "", style }: { children: ReactNode; className?: string; style?: CSSProperties }) {
  return (
    <div className={`relative ${className}`} style={style}>
      <span aria-hidden="true" className="absolute -top-[0.7%] right-[14%] h-[0.8%] w-[9%] rounded-t-sm" style={{ background: "linear-gradient(180deg,#8d8e92,#cfd0d3)" }} />
      <div
        className="relative rounded-[6.5%/4.6%] p-[1%]"
        style={{
          background: "linear-gradient(135deg,#e6e7e9 0%,#a7a9ad 30%,#dcdde0 55%,#96989c 100%)",
          boxShadow: "0 30px 60px rgba(16,16,16,0.18), 0 8px 16px rgba(16,16,16,0.08)",
        }}
      >
        <div className="relative rounded-[5.6%/4%] bg-[#050506] p-[4.3%]">
          <div className="relative overflow-hidden rounded-[2.4%/1.7%] bg-white" style={{ aspectRatio: "1668 / 2388" }}>
            {children}
            <div aria-hidden="true" className="pointer-events-none absolute inset-0" style={{ background: "linear-gradient(120deg, rgba(255,255,255,0.12) 0%, transparent 32%)" }} />
          </div>
          <span aria-hidden="true" className="absolute left-1/2 top-[1.6%] h-[0.6%] w-[0.9%] -translate-x-1/2 rounded-full bg-[#1b1d26]" />
        </div>
      </div>
    </div>
  );
}

/** Screen image; `top` leaves room for a status bar (iPhone). */
export function Screen({ src, alt, width, height, top = 0 }: { src: string; alt: string; width: number; height: number; top?: number }) {
  return (
    <img
      src={src}
      alt={alt}
      width={width}
      height={height}
      className="absolute inset-x-0 bottom-0 block w-full object-cover object-top"
      style={{ top: `${top}%`, height: `${100 - top}%` }}
    />
  );
}
