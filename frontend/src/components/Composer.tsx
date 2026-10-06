import { motion } from "framer-motion";
import { ArrowUp, Square } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { spring } from "../lib/motion";
import { cn } from "../lib/utils";

export function Composer({
  onSubmit,
  busy,
  hero = false,
  placeholder = "Hỏi về điểm chuẩn, chỉ tiêu, học phí, phương thức xét tuyển…",
  autoFocus = false,
}: {
  onSubmit: (q: string) => void;
  busy: boolean;
  hero?: boolean;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const [value, setValue] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
  }, [value]);

  function submit(e?: FormEvent) {
    e?.preventDefault();
    const q = value.trim();
    if (!q || busy) return;
    onSubmit(q);
    setValue("");
  }

  function onKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  }

  return (
    <motion.form
      layoutId="composer"
      transition={spring}
      onSubmit={submit}
      className={cn("teal-glow rounded-inputs bg-parchment", hero ? "px-4 pt-4 pb-3" : "px-3.5 pt-3 pb-2.5")}
    >
      <textarea
        ref={ref}
        rows={hero ? 2 : 1}
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={onKey}
        maxLength={500}
        placeholder={placeholder}
        aria-label="Câu hỏi"
        className="block w-full resize-none bg-transparent text-body-lg leading-[1.5] text-ink placeholder:text-graphite focus:outline-none"
      />
      <div className="mt-2 flex items-center justify-between">
        <span className="text-body-sm text-ash">{value.length > 0 ? `${value.length}/500` : "Enter để gửi · Shift+Enter xuống dòng"}</span>
        <motion.button
          type="submit"
          whileTap={{ scale: 0.94 }}
          disabled={!value.trim() && !busy}
          aria-label={busy ? "Đang trả lời" : "Gửi"}
          className={cn(
            "grid h-8 w-8 place-items-center rounded-inputs transition-colors",
            value.trim() || busy ? "bg-ink text-parchment" : "bg-hairline text-ash",
          )}
        >
          {busy ? <Square size={12} fill="currentColor" /> : <ArrowUp size={16} />}
        </motion.button>
      </div>
    </motion.form>
  );
}
