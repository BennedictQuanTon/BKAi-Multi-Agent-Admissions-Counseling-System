import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import { ArrowRight, BookOpenCheck, Calculator, GraduationCap, Landmark, Mic, Sparkles } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { AgentTrace } from "../components/AgentTrace";
import { AnswerMeta, Markdown, Sources } from "../components/Answer";
import { Composer } from "../components/Composer";
import { api, ChatSocket, getSessionId, loadTranscript, rememberSession, saveTranscript, type ChatEvent, type Done, type Source, type TraceEvent } from "../lib/api";
import { fadeUp, spring, stagger } from "../lib/motion";

type Turn = {
  id: string;
  q: string;
  shown: string;
  target: string;
  trace: TraceEvent[];
  sources: Source[];
  done?: Done;
  error?: string;
  restored?: boolean;
};

const SUGGESTIONS = [
  { icon: GraduationCap, title: "Điểm chuẩn 2026", desc: "Ngành Khoa học Máy tính lấy bao nhiêu điểm năm nay?", q: "Điểm chuẩn ngành Khoa học Máy tính năm 2026 là bao nhiêu?" },
  { icon: Calculator, title: "Công thức xét tuyển", desc: "Điểm học lực, điểm cộng, điểm ưu tiên tính thế nào?", q: "Công thức tính điểm xét tuyển tổng hợp năm 2026 gồm những gì?" },
  { icon: Landmark, title: "Học phí", desc: "So sánh học phí chương trình tiêu chuẩn và tiếng Anh", q: "Học phí chương trình tiêu chuẩn và chương trình tiếng Anh năm 2026-2027 là bao nhiêu?" },
  { icon: BookOpenCheck, title: "Chọn ngành", desc: "Mình được 80 điểm, thích AI thì nên chọn ngành nào?", q: "Mình được khoảng 80 điểm xét tuyển tổng hợp, thích AI và máy tính, nên chọn ngành nào?" },
];

const FOLLOW_UPS: Record<string, string[]> = {
  facts: ["Chỉ tiêu năm 2026 của ngành này là bao nhiêu?", "Tổ hợp xét tuyển của ngành này gồm những môn nào?"],
  policy: ["Chuẩn tiếng Anh đầu vào của chương trình dạy bằng tiếng Anh là gì?", "Điểm ưu tiên khu vực được tính như thế nào?"],
  counsel: ["Học phí của các chương trình được gợi ý là bao nhiêu?", "Nếu có thêm điểm ưu tiên khu vực thì kết quả thay đổi ra sao?"],
};

function Wordmark() {
  return (
    <motion.h1 variants={stagger(0.05)} initial="hidden" animate="show" className="flex justify-center text-[44px] font-medium tracking-tight text-ink" aria-label="BKAi">
      {"BKAi".split("").map((c, i) => (
        <motion.span key={i} variants={{ hidden: { opacity: 0, y: 14, filter: "blur(0px)" }, show: { opacity: 1, y: 0, transition: spring } }}>
          {c}
        </motion.span>
      ))}
    </motion.h1>
  );
}

export default function ChatPage({ sessionId, onFirstQuestion }: { sessionId: string; onFirstQuestion: (q: string) => void }) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);
  const socket = useRef(new ChatSocket());
  const bottom = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();

  // Restore the conversation: this device's transcript first (instant, survives server TTL),
  // otherwise the server's memory of the session (last 12 messages).
  useEffect(() => {
    const sid = params.get("s") || sessionId;
    const local = loadTranscript(sid);
    setTurns(local.map((t, i) => ({ id: `l${i}`, q: t.q, shown: t.a, target: t.a, trace: [], sources: t.sources ?? [], restored: true })));
    if (local.length) return;
    api.session(sid).then(({ history }) => {
      const restored: Turn[] = [];
      for (let i = 0; i < history.length; i += 2) {
        const a = history[i + 1]?.content ?? "";
        restored.push({ id: `r${i}`, q: history[i].content, shown: a, target: a, trace: [], sources: [], restored: true });
      }
      setTurns(restored);
    }).catch(() => undefined);
  }, [params, sessionId]);

  // keep this device's copy of the transcript up to date (finished turns only)
  useEffect(() => {
    if (busy) return;
    const done = turns.filter((t) => (t.done || t.restored) && t.target);
    if (done.length) saveTranscript(params.get("s") || sessionId, done.map((t) => ({ q: t.q, a: t.target, sources: t.sources.slice(0, 6) })));
  }, [turns, busy, params, sessionId]);

  useEffect(() => () => socket.current.close(), []);

  // smooth streaming: reveal buffered tokens at a steady, backlog-proportional pace
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      setTurns((ts) => {
        let changed = false;
        const next = ts.map((t) => {
          if (t.shown.length >= t.target.length) return t;
          changed = true;
          const backlog = t.target.length - t.shown.length;
          const step = Math.max(2, Math.ceil(backlog / 12));
          return { ...t, shown: t.target.slice(0, t.shown.length + step) };
        });
        return changed ? next : ts;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    if (turns.length) bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns.length, busy]);

  const ask = useCallback(
    async (q: string) => {
      const sid = params.get("s") || sessionId;
      if (!turns.length) {
        onFirstQuestion(q);
        rememberSession(sid, q);
      }
      const id = crypto.randomUUID();
      setTurns((ts) => [...ts, { id, q, shown: "", target: "", trace: [], sources: [] }]);
      setBusy(true);
      const update = (fn: (t: Turn) => Turn) => setTurns((ts) => ts.map((t) => (t.id === id ? fn(t) : t)));
      try {
        await socket.current.ask(q, sid, (ev: ChatEvent) => {
          if (ev.type === "token") update((t) => ({ ...t, target: t.target + ev.content }));
          else if (ev.type === "agent" || ev.type === "tool") update((t) => ({ ...t, trace: [...t.trace, ev as TraceEvent] }));
          else if (ev.type === "sources") update((t) => ({ ...t, sources: ev.sources }));
          else if (ev.type === "replace") update((t) => ({ ...t, target: ev.answer, shown: ev.answer }));
          else if (ev.type === "done") update((t) => ({ ...t, done: ev, target: ev.answer, sources: ev.sources?.length ? ev.sources : t.sources }));
          else if (ev.type === "error") update((t) => ({ ...t, error: ev.message }));
        });
      } catch (e) {
        update((t) => ({ ...t, error: (e as Error).message }));
      } finally {
        setBusy(false);
      }
    },
    [params, sessionId, turns.length, onFirstQuestion],
  );

  // question handed over from another page (e.g. the score calculator)
  const handed = useRef(false);
  useEffect(() => {
    const q = (location.state as { q?: string } | null)?.q;
    if (q && !handed.current) {
      handed.current = true;
      navigate(location.pathname, { replace: true, state: null });
      ask(q);
    }
  }, [location.state, location.pathname, navigate, ask]);

  const empty = turns.length === 0;

  return (
    <LayoutGroup>
      <div className="flex h-full flex-col">
        <div className="scrollbar-thin flex-1 overflow-y-auto">
          <AnimatePresence mode="wait">
            {empty ? (
              <motion.div key="hero" exit={{ opacity: 0, y: -10 }} className="mx-auto flex min-h-full w-full max-w-[720px] flex-col justify-center px-4 pb-24 pt-10 sm:px-6">
                <Wordmark />
                <motion.p variants={fadeUp} initial="hidden" animate="show" className="mt-1 text-center text-body-lg text-graphite">
                  Tư vấn tuyển sinh Trường ĐH Bách khoa – ĐHQG-HCM, trả lời bằng dữ liệu chính thức 2026.
                </motion.p>
                <div className="mt-8">
                  <Composer hero onSubmit={ask} busy={busy} autoFocus />
                </div>
                <motion.div variants={stagger(0.05, 0.15)} initial="hidden" animate="show" className="mt-3 flex flex-wrap gap-2">
                  {[
                    { label: "Hỏi đáp", icon: Sparkles, active: true, to: "/chat" },
                    { label: "Tính điểm & chọn ngành", icon: Calculator, to: "/counselor" },
                    { label: "Giọng nói", icon: Mic, to: "/voice" },
                  ].map((c) => (
                    <motion.button
                      key={c.label}
                      variants={fadeUp}
                      onClick={() => c.to !== "/chat" && navigate(c.to)}
                      className={
                        c.active
                          ? "flex items-center gap-1.5 rounded-full bg-brand px-3 py-1.5 text-body text-white"
                          : "flex items-center gap-1.5 rounded-full border border-warm-mist px-3 py-1.5 text-body text-ink hover:border-ash"
                      }
                    >
                      <c.icon size={14} /> {c.label}
                    </motion.button>
                  ))}
                </motion.div>
                <motion.div variants={stagger(0.06, 0.25)} initial="hidden" animate="show" className="mt-8 grid gap-3 sm:grid-cols-2">
                  {SUGGESTIONS.map((s) => (
                    <motion.button
                      key={s.title}
                      variants={fadeUp}
                      whileHover={{ y: -2 }}
                      whileTap={{ scale: 0.99 }}
                      onClick={() => ask(s.q)}
                      className="group flex items-start gap-3 rounded-cards bg-soft-paper px-4 py-3 text-left shadow-subtle"
                    >
                      <s.icon size={18} className="mt-0.5 shrink-0 text-ink" />
                      <span>
                        <span className="block text-body-lg text-ink">{s.title}</span>
                        <span className="block text-body text-graphite">{s.desc}</span>
                      </span>
                      <ArrowRight size={14} className="ml-auto mt-1 shrink-0 text-ash opacity-0 transition-opacity group-hover:opacity-100" />
                    </motion.button>
                  ))}
                </motion.div>
              </motion.div>
            ) : (
              <motion.div key="thread" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mx-auto w-full max-w-[900px] px-4 pb-8 pt-8 sm:px-6">
                {turns.map((t, i) => (
                  <TurnView key={t.id} turn={t} last={i === turns.length - 1} busy={busy} onAsk={ask} />
                ))}
                <div ref={bottom} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        {!empty && (
          <div className="border-t border-hairline bg-parchment/95 px-4 pb-4 pt-3 sm:px-6">
            <div className="mx-auto max-w-[900px]">
              <Composer onSubmit={ask} busy={busy} placeholder="Hỏi tiếp…" autoFocus />
            </div>
          </div>
        )}
      </div>
    </LayoutGroup>
  );
}

function TurnView({ turn, last, busy, onAsk }: { turn: Turn; last: boolean; busy: boolean; onAsk: (q: string) => void }) {
  const live = !turn.done && !turn.error && !turn.restored;
  const streaming = live || turn.shown.length < turn.target.length;
  const intents = turn.done?.plan?.intents ?? [];
  const follow = [...new Set(intents.flatMap((i) => FOLLOW_UPS[i] ?? []))].slice(0, 3);

  return (
    <motion.article initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={spring} className="border-b border-hairline py-6 last:border-0">
      <h2 className="text-[22px] font-medium leading-snug tracking-tight text-ink">{turn.q}</h2>
      {!turn.restored && (
        <div className="mt-4">
          <AgentTrace events={turn.trace} live={live} />
        </div>
      )}
      {turn.sources.length > 0 && (
        <div className="mt-5">
          <div className="mb-2 text-body-sm text-graphite">Nguồn</div>
          <Sources sources={turn.sources} />
        </div>
      )}
      <div className="mt-5">
        {turn.error ? (
          <p className="text-body-lg text-graphite">{turn.error}</p>
        ) : turn.shown ? (
          <Markdown text={turn.shown} sources={turn.sources} streaming={streaming} />
        ) : (
          <div className="space-y-2" aria-label="Đang soạn câu trả lời">
            <div className="shimmer h-4 w-11/12 rounded-buttons" />
            <div className="shimmer h-4 w-9/12 rounded-buttons" />
            <div className="shimmer h-4 w-10/12 rounded-buttons" />
          </div>
        )}
      </div>
      {turn.done && !streaming && (
        <div className="mt-4">
          <AnswerMeta done={turn.done} />
        </div>
      )}
      {last && turn.done && !busy && follow.length > 0 && !streaming && (
        <motion.div variants={stagger(0.05, 0.2)} initial="hidden" animate="show" className="mt-6">
          <div className="mb-2 text-body-sm text-graphite">Câu hỏi liên quan</div>
          <div className="divide-y divide-hairline border-y border-hairline">
            {follow.map((f) => (
              <motion.button key={f} variants={fadeUp} onClick={() => onAsk(f)} className="flex w-full items-center justify-between py-2.5 text-left text-body-lg text-ink hover:text-graphite">
                {f} <ArrowRight size={14} className="text-ash" />
              </motion.button>
            ))}
          </div>
        </motion.div>
      )}
    </motion.article>
  );
}
