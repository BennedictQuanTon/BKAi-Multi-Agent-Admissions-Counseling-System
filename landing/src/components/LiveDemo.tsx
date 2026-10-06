import { useInView, useReducedMotion } from "framer-motion";
import { ArrowUp, BarChart3, Calculator, Check, Database, Loader2, MessageSquare, Mic, Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Mark } from "./Brand";

// A replay of a real BKAi answer (captured 2026-10-06), rendered in the DOM so it stays crisp at any size.
const QUESTION = "Mình được khoảng 80 điểm xét tuyển tổng hợp, thích AI và máy tính. Nên chọn ngành nào?";
const GLOSS = "“I scored about 80 and love AI and computers. Which major should I pick?”";

const STEPS = [
  { name: "Guardrails", sub: "allow · in scope", at: 2.7, done: 2.75, ms: "0 ms" },
  { name: "Supervisor", sub: "intents: counsel, facts", at: 2.8, done: 4.0, ms: "1.2 s" },
  { name: "Counsel agent", sub: "recommend_majors · score 80", at: 4.05, done: 4.15, ms: "1 ms" },
  { name: "Data agent", sub: "get_admission_scores · 26 rows", at: 4.05, done: 4.2, ms: "1 ms" },
  { name: "Synthesizer", sub: "writing with citations", at: 4.3, done: 9.0, ms: "4.0 s" },
  { name: "Verifier", sub: "every number matches evidence", at: 9.05, done: 9.15, ms: "0 ms" },
];

const SOURCES = ["Khoa học Máy tính (306)", "Kỹ thuật Máy tính (307)", "Khoa học Máy tính (266)", "Trí tuệ Nhân tạo (406)", "Khoa học Máy tính (106)"];

const INTRO = "Với khoảng 80 điểm và yêu thích AI, đây là các lựa chọn so với điểm chuẩn Xét tuyển Tổng hợp 2026:";
const ROWS = [
  { band: "Vừa sức", tone: "match", text: "Khoa học Máy tính · 266 (Định hướng Nhật Bản)", score: "78.69", cite: 3 },
  { band: "An toàn", tone: "safe", text: "Trí tuệ Nhân tạo · 406 (Liên kết UTS)", score: "73.21", cite: 4 },
  { band: "An toàn", tone: "safe", text: "Khoa học Máy tính · 306 (Chuyển tiếp Quốc tế)", score: "70.84", cite: 1 },
  { band: "Thử thách", tone: "reach", text: "Khoa học Máy tính · 106 (Tiêu chuẩn)", score: "85.45", cite: 5 },
];
const TOTAL_CHARS = INTRO.length + ROWS.reduce((n, r) => n + r.text.length + r.score.length, 0);

const LOOP = 16;
const TYPE_START = 0.5;
const TYPE_END = 2.3;
const ASKED = 2.5;
const STREAM_START = 4.6;
const STREAM_END = 8.9;

function useClock(active: boolean) {
  const [t, setT] = useState(0);
  const reduce = useReducedMotion();
  useEffect(() => {
    if (reduce) {
      setT(12);
      return;
    }
    if (!active) return;
    let raf = 0;
    const start = performance.now() - t * 1000;
    const tick = (now: number) => {
      setT(((now - start) / 1000) % LOOP);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, reduce]); // eslint-disable-line react-hooks/exhaustive-deps
  return t;
}

const clamp = (v: number) => Math.min(1, Math.max(0, v));

export default function LiveDemo() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "-10% 0px" });
  const t = useClock(inView);

  const typed = QUESTION.slice(0, Math.round(clamp((t - TYPE_START) / (TYPE_END - TYPE_START)) * QUESTION.length));
  const asked = t >= ASKED;
  let budget = Math.round(clamp((t - STREAM_START) / (STREAM_END - STREAM_START)) * TOTAL_CHARS);
  const take = (s: string) => {
    const out = s.slice(0, Math.max(0, budget));
    budget -= s.length;
    return out;
  };
  const intro = take(INTRO);
  const rows = ROWS.map((r) => ({ ...r, shown: take(r.text), scoreShown: take(r.score) }));
  const streaming = t >= STREAM_START && t < STREAM_END;
  const verified = t >= 9.15;
  const fade = t > LOOP - 0.8 ? 1 - (t - (LOOP - 0.8)) / 0.8 : 1;

  return (
    <div ref={ref} className="flex h-full bg-[#faf8f5] text-left text-[#27251e]" style={{ fontFamily: "var(--font-sans)" }}>
      {/* sidebar */}
      <aside className="hidden w-[23%] min-w-[150px] flex-col border-r border-black/[0.06] bg-[#f3f1ec] p-3 md:flex">
        <div className="flex items-center gap-2 px-1 pb-3">
          <Mark size={18} />
          <span className="text-[13px] font-semibold">BKAi</span>
        </div>
        <div className="flex items-center gap-1.5 rounded-lg border border-black/10 bg-white/70 px-2.5 py-1.5 text-[11px]">
          <Plus size={12} /> Cuộc trò chuyện mới
        </div>
        <nav className="mt-3 space-y-1 text-[11px]">
          <div className="flex items-center gap-2 rounded-lg bg-[#016a71] px-2.5 py-1.5 text-white">
            <MessageSquare size={12} /> Hỏi đáp
          </div>
          {[
            [Mic, "Trò chuyện giọng nói"],
            [Calculator, "Tính điểm & chọn ngành"],
            [BarChart3, "Dashboard"],
          ].map(([Icon, label]) => {
            const I = Icon as typeof Mic;
            return (
              <div key={label as string} className="flex items-center gap-2 px-2.5 py-1.5 text-[#72706b]">
                <I size={12} /> {label as string}
              </div>
            );
          })}
        </nav>
      </aside>

      {/* conversation */}
      <div className="relative flex min-w-0 flex-1 flex-col">
        <div className="flex-1 overflow-hidden px-[5%] pt-5" style={{ opacity: fade }}>
          {asked && (
            <div className="r-in ml-auto max-w-[78%] rounded-2xl rounded-br-md bg-[#efece6] px-3.5 py-2 text-[12px] leading-[1.45] sm:text-[13px]">
              {QUESTION}
              <div className="mt-1 text-[10.5px] italic text-[#92918b]">{GLOSS}</div>
            </div>
          )}

          {asked && (
            <div className="mt-3 rounded-xl border border-black/[0.08] bg-white/60 px-3 py-2">
              <div className="flex items-center gap-1.5 text-[11px] text-[#72706b]">
                {verified ? <Check size={12} className="text-[#016a71]" /> : <Loader2 size={12} className="animate-spin" />}
                <span className="font-medium text-[#27251e]">Cách BKAi tìm câu trả lời</span>· 2 tác tử · 4 công cụ
              </div>
              <ul className="mt-1.5 space-y-[5px]">
                {STEPS.map((s) => {
                  if (t < s.at) return null;
                  const done = t >= s.done;
                  return (
                    <li key={s.name} className="r-in flex items-center gap-2 text-[11px]">
                      <span className={`flex h-[14px] w-[14px] shrink-0 items-center justify-center rounded-full ${done ? "bg-[#016a71] text-white" : "border border-[#016a71]/40"}`}>
                        {done ? <Check size={9} strokeWidth={3} /> : <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#016a71]" />}
                      </span>
                      <span className="font-medium">{s.name}</span>
                      <span className="hidden truncate text-[#92918b] sm:inline">{s.sub}</span>
                      <span className="ml-auto tnum text-[#92918b]">{done ? s.ms : ""}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {t >= 4.4 && (
            <div className="r-in mt-3 flex gap-1.5 overflow-hidden">
              {SOURCES.map((s, i) => (
                <div key={s} className="min-w-[96px] flex-1 rounded-lg border border-black/[0.08] bg-white/70 px-2 py-1.5">
                  <div className="flex items-center gap-1 text-[9.5px] text-[#92918b]">
                    <Database size={9} /> [{i + 1}] hcmut.edu.vn
                  </div>
                  <div className="truncate text-[10.5px]">{s}</div>
                </div>
              ))}
            </div>
          )}

          {t >= STREAM_START && (
            <div className="mt-3 text-[12px] leading-[1.6] sm:text-[13px]">
              <p>
                {intro}
                {streaming && budget <= 0 && intro.length < INTRO.length && <span className="caret" />}
              </p>
              <ul className="mt-1.5 space-y-1">
                {rows.map((r, i) =>
                  r.shown ? (
                    <li key={i} className="flex flex-wrap items-baseline gap-x-2">
                      <span
                        className={`rounded-full px-1.5 py-px text-[10px] font-medium ${
                          r.tone === "safe" ? "bg-[#016a71] text-white" : r.tone === "match" ? "border border-[#016a71] text-[#016a71]" : "border border-black/15 text-[#72706b]"
                        }`}
                      >
                        {r.band}
                      </span>
                      <span className="font-medium">{r.shown}</span>
                      {r.scoreShown && (
                        <span className="tnum">
                          — <b>{r.scoreShown}</b>
                          {r.scoreShown.length === r.score.length && (
                            <span className="ml-1 inline-flex h-[15px] min-w-[15px] items-center justify-center rounded-full bg-[#e9e6df] px-1 text-[9.5px] text-[#27251e]">{r.cite}</span>
                          )}
                        </span>
                      )}
                    </li>
                  ) : null,
                )}
              </ul>
              {streaming && <span className="caret" />}
              {verified && (
                <div className="r-in mt-2 flex items-center gap-1.5 text-[10.5px] text-[#72706b]">
                  <span className="flex items-center gap-1 rounded-full bg-[#016a71]/10 px-2 py-0.5 text-[#016a71]">
                    <Check size={10} strokeWidth={3} /> Mọi con số đã được kiểm chứng
                  </span>
                  <span className="tnum">· 6.2 s · Supervisor lập kế hoạch</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* composer */}
        <div className="px-[5%] pb-4 pt-2">
          <div className="flex items-center gap-2 rounded-2xl border border-black/10 bg-white/80 px-3.5 py-2.5 text-[12px] sm:text-[13px]">
            <span className={`min-w-0 flex-1 truncate ${typed && !asked ? "text-[#27251e]" : "text-[#92918b]"}`}>
              {asked ? "Hỏi tiếp..." : typed || "Hỏi về điểm chuẩn, chỉ tiêu, học phí..."}
              {!asked && t >= TYPE_START && <span className="caret" />}
            </span>
            <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${typed && !asked ? "bg-[#27251e] text-white" : "bg-black/5 text-[#92918b]"}`}>
              <ArrowUp size={14} />
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
