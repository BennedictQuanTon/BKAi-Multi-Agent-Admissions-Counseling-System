import { AnimatePresence, motion } from "framer-motion";
import { BadgeCheck, Database, ExternalLink, FileText, Calculator, ThumbsDown, ThumbsUp, Zap } from "lucide-react";
import { useState, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Done, Source } from "../lib/api";
import { api } from "../lib/api";
import { fadeUp, stagger } from "../lib/motion";
import { cn } from "../lib/utils";

const KIND_ICON = { fact: Database, doc: FileText, calc: Calculator, note: FileText } as const;

export function Sources({ sources }: { sources: Source[] }) {
  if (!sources.length) return null;
  return (
    <motion.div variants={stagger(0.04)} initial="hidden" animate="show" className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
      {sources.slice(0, 8).map((s) => {
        const Icon = KIND_ICON[s.kind as keyof typeof KIND_ICON] ?? FileText;
        return (
          <motion.a
            key={s.id}
            variants={fadeUp}
            href={s.url || undefined}
            target="_blank"
            rel="noreferrer"
            whileHover={{ y: -1 }}
            className="group flex w-[180px] shrink-0 flex-col gap-1 rounded-inputs border border-hairline bg-soft-paper p-2.5 hover:border-warm-mist"
          >
            <span className="flex items-center gap-1.5 text-caption text-graphite">
              <Icon size={12} />
              <span className="tabular">[{s.id}]</span>
              <span className="truncate">{hostOf(s.url)}</span>
            </span>
            <span className="line-clamp-2 text-body-sm text-ink">{s.title}</span>
          </motion.a>
        );
      })}
    </motion.div>
  );
}

function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace("www.", "");
  } catch {
    return "dữ liệu nội bộ";
  }
}

/** Turns [n] markers into hoverable citation chips. */
function withCitations(children: ReactNode, sources: Source[]): ReactNode {
  if (typeof children === "string") {
    const parts = children.split(/(\[\d+\])/g);
    return parts.map((p, i) => {
      const m = p.match(/^\[(\d+)\]$/);
      if (!m) return p;
      const src = sources.find((s) => s.id === Number(m[1]));
      return <Cite key={i} n={Number(m[1])} source={src} />;
    });
  }
  if (Array.isArray(children)) return children.map((c, i) => <span key={i}>{withCitations(c, sources)}</span>);
  return children;
}

function Cite({ n, source }: { n: number; source?: Source }) {
  const [hover, setHover] = useState(false);
  return (
    <span className="relative inline-block" onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <a
        href={source?.url || undefined}
        target="_blank"
        rel="noreferrer"
        className="mx-0.5 inline-grid h-[18px] min-w-[18px] place-items-center rounded-full bg-hairline px-1 align-[2px] text-[11px] font-medium text-graphite no-underline hover:bg-brand hover:text-white"
      >
        {n}
      </a>
      <AnimatePresence>
        {hover && source && (
          <motion.span
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.15 }}
            className="absolute bottom-6 left-1/2 z-20 w-64 -translate-x-1/2 rounded-inputs border border-hairline bg-soft-paper p-2.5 text-left shadow-subtle"
          >
            <span className="block text-body-sm text-ink">{source.title}</span>
            <span className="mt-1 flex items-center gap-1 text-caption text-graphite">
              <ExternalLink size={10} /> {hostOf(source.url)} · {source.agent} agent
            </span>
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}

export function Markdown({ text, sources, streaming }: { text: string; sources: Source[]; streaming: boolean }) {
  return (
    <div className={cn("prose-bk", streaming && "caret")}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p>{withCitations(children, sources)}</p>,
          li: ({ children }) => <li>{withCitations(children, sources)}</li>,
          td: ({ children }) => <td>{withCitations(children, sources)}</td>,
          a: ({ href, children }) => <a href={href} target="_blank" rel="noreferrer">{children}</a>,
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}

export function AnswerMeta({ done }: { done: Done }) {
  const [vote, setVote] = useState<"like" | "dislike" | null>(null);
  const v = done.verification || {};
  const send = (f: "like" | "dislike") => {
    setVote(f);
    api.feedback(done.question_id, f).catch(() => undefined);
  };
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-body-sm text-graphite">
      {done.cached ? (
        <span className="flex items-center gap-1"><Zap size={13} /> Trả lời từ cache đã duyệt</span>
      ) : v.checked ? (
        <span className={cn("flex items-center gap-1", v.passed ? "text-ink" : "text-graphite")}>
          <BadgeCheck size={14} className={v.passed ? "text-brand" : ""} />
          {v.passed ? (v.repaired ? "Đã tự sửa & kiểm chứng số liệu" : "Mọi con số đã được kiểm chứng") : "Có số liệu chưa kiểm chứng"}
        </span>
      ) : null}
      <span className="tabular">{(done.latency_ms / 1000).toFixed(1)}s{done.ttft_ms ? ` · chữ đầu ${(done.ttft_ms / 1000).toFixed(1)}s` : ""}</span>
      <span>{routeLabel(done.route)}</span>
      <span className="ml-auto flex items-center gap-1">
        <button aria-label="Hữu ích" onClick={() => send("like")} className={cn("rounded-buttons p-1.5 hover:bg-hairline", vote === "like" && "text-brand")}>
          <ThumbsUp size={14} />
        </button>
        <button aria-label="Chưa đúng" onClick={() => send("dislike")} className={cn("rounded-buttons p-1.5 hover:bg-hairline", vote === "dislike" && "text-ink")}>
          <ThumbsDown size={14} />
        </button>
      </span>
    </motion.div>
  );
}

export function routeLabel(route: string) {
  return (
    { fast_path: "Định tuyến nhanh · 1 lần gọi LLM", supervisor: "Supervisor lập kế hoạch", cache: "Semantic cache", guardrail: "Guardrails" } as Record<string, string>
  )[route] ?? route;
}
