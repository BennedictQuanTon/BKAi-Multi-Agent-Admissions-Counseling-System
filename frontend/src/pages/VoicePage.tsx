import { AnimatePresence, motion } from "framer-motion";
import { Keyboard, Mic, MicOff, Square } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { VoiceOrb, type VoiceState } from "../components/VoiceOrb";
import { API_BASE, getSessionId, WS_BASE, type TraceEvent } from "../lib/api";
import { fadeUp, spring } from "../lib/motion";
import { cn } from "../lib/utils";

type Line = { role: "user" | "bot"; text: string; partial?: boolean };

const STATE_LABEL: Record<VoiceState, string> = {
  idle: "Nhấn micro để bắt đầu",
  listening: "Đang nghe…",
  thinking: "Các tác tử đang tra cứu…",
  speaking: "BKAi đang trả lời",
};

export default function VoicePage() {
  const [state, setState] = useState<VoiceState>("idle");
  const [lines, setLines] = useState<Line[]>([]);
  const [stt, setStt] = useState<string>("…");
  const [agent, setAgent] = useState<string>("");
  const [text, setText] = useState("");
  const ws = useRef<WebSocket | null>(null);
  const ctx = useRef<AudioContext | null>(null);
  const micNode = useRef<AudioWorkletNode | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const micLevel = useRef(0);
  const outAnalyser = useRef<AnalyserNode | null>(null);
  const playHead = useRef(0);
  const sources = useRef<AudioBufferSourceNode[]>([]);
  const pttHeld = useRef(false);
  const streamingStt = useRef(false);

  useEffect(() => () => stop(), []);

  function level(): number {
    if (state === "speaking" && outAnalyser.current) {
      const a = new Float32Array(outAnalyser.current.fftSize);
      outAnalyser.current.getFloatTimeDomainData(a);
      return Math.sqrt(a.reduce((s, v) => s + v * v, 0) / a.length);
    }
    return micLevel.current;
  }

  function stopPlayback() {
    sources.current.forEach((s) => {
      try {
        s.stop();
      } catch {
        /* already stopped */
      }
    });
    sources.current = [];
    playHead.current = 0;
  }

  function playPcm(buf: ArrayBuffer) {
    const ac = ctx.current;
    if (!ac) return;
    const pcm = new Int16Array(buf);
    const audio = ac.createBuffer(1, pcm.length, 24000);
    const ch = audio.getChannelData(0);
    for (let i = 0; i < pcm.length; i++) ch[i] = pcm[i] / 32768;
    const src = ac.createBufferSource();
    src.buffer = audio;
    src.connect(outAnalyser.current!);
    const at = Math.max(ac.currentTime + 0.02, playHead.current);
    src.start(at);
    playHead.current = at + audio.duration;
    sources.current.push(src);
    src.onended = () => {
      sources.current = sources.current.filter((s) => s !== src);
      if (!sources.current.length) setState((s) => (s === "speaking" ? "listening" : s));
    };
    setState("speaking");
  }

  async function start() {
    const ac = new AudioContext();
    ctx.current = ac;
    const analyser = ac.createAnalyser();
    analyser.fftSize = 1024;
    analyser.connect(ac.destination);
    outAnalyser.current = analyser;

    const sock = new WebSocket(`${WS_BASE}/ws/voice`);
    sock.binaryType = "arraybuffer";
    ws.current = sock;
    sock.onopen = () => sock.send(JSON.stringify({ type: "start", session_id: `voice-${getSessionId()}` }));
    sock.onmessage = (m) => {
      if (m.data instanceof ArrayBuffer) return playPcm(m.data);
      const ev = JSON.parse(m.data);
      if (ev.type === "ready") {
        streamingStt.current = ev.stt === "assemblyai";
        setStt(streamingStt.current ? "AssemblyAI Universal-3.6 Pro (streaming)" : "Whisper large-v3-turbo (giữ để nói)");
      }
      else if (ev.type === "stt_partial") upsertUser(ev.text, true);
      else if (ev.type === "stt_final") {
        upsertUser(ev.text, false);
        setState("thinking");
      } else if (ev.type === "agent") setAgent(`${(ev as TraceEvent).agent} · ${(ev as TraceEvent).detail ?? ""}`);
      else if (ev.type === "token") appendBot(ev.content);
      else if (ev.type === "replace") replaceBot(ev.answer);
      else if (ev.type === "interrupt") stopPlayback();
      else if (ev.type === "done") setAgent("");
    };

    const media = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 } });
    stream.current = media;
    await ac.audioWorklet.addModule("/pcm-worklet.js");
    const node = new AudioWorkletNode(ac, "pcm-capture");
    node.port.onmessage = (e) => {
      if (e.data.level !== undefined) micLevel.current = e.data.level;
      if (e.data.pcm && sock.readyState === WebSocket.OPEN && (streamingStt.current || pttHeld.current)) sock.send(e.data.pcm);
    };
    ac.createMediaStreamSource(media).connect(node);
    micNode.current = node;
    setState("listening");
  }

  function stop() {
    ws.current?.close();
    stream.current?.getTracks().forEach((t) => t.stop());
    micNode.current?.disconnect();
    ctx.current?.close().catch(() => undefined);
    ws.current = null;
    ctx.current = null;
    setState("idle");
  }

  function upsertUser(t: string, partial: boolean) {
    setLines((ls) => {
      const last = ls[ls.length - 1];
      if (last?.role === "user" && last.partial) return [...ls.slice(0, -1), { role: "user", text: t, partial }];
      return [...ls, { role: "user", text: t, partial }];
    });
  }
  function appendBot(t: string) {
    setLines((ls) => {
      const last = ls[ls.length - 1];
      if (last?.role === "bot") return [...ls.slice(0, -1), { ...last, text: last.text + t }];
      return [...ls, { role: "bot", text: t }];
    });
  }
  function replaceBot(t: string) {
    setLines((ls) => (ls[ls.length - 1]?.role === "bot" ? [...ls.slice(0, -1), { role: "bot", text: t }] : ls));
  }

  function pttDown() {
    if (state === "idle") return;
    stopPlayback();
    ws.current?.send(JSON.stringify({ type: "interrupt" }));
    pttHeld.current = true;
    setState("listening");
  }
  function pttUp() {
    if (!pttHeld.current) return;
    pttHeld.current = false;
    ws.current?.send(JSON.stringify({ type: "end_utterance" }));
    setState("thinking");
  }
  function sendText() {
    if (!text.trim() || !ws.current) return;
    upsertUser(text.trim(), false);
    ws.current.send(JSON.stringify({ type: "text", query: text.trim() }));
    setText("");
    setState("thinking");
  }

  const ptt = state !== "idle" && !streamingStt.current;

  return (
    <div className="mx-auto flex h-full w-full max-w-[900px] flex-col px-4 py-8 sm:px-6">
      <motion.header variants={fadeUp} initial="hidden" animate="show">
        <h1 className="text-[22px] font-medium tracking-tight">Trò chuyện giọng nói</h1>
        <p className="text-body text-graphite">
          Nói tiếng Việt tự nhiên. Âm thanh trả lời được tổng hợp <span className="text-ink">từng câu ngay khi LLM đang viết</span> bằng Kokoro-Vietnamese, có thể ngắt lời bất cứ lúc nào.
        </p>
      </motion.header>

      <div className="mt-6 grid flex-1 gap-6 md:grid-cols-[280px_1fr]">
        <div className="flex flex-col items-center gap-4">
          <VoiceOrb state={state} level={level} />
          <AnimatePresence mode="wait">
            <motion.div key={state} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} className="text-center text-body text-ink">
              {STATE_LABEL[state]}
            </motion.div>
          </AnimatePresence>
          {agent && <div className="line-clamp-2 text-center text-body-sm text-graphite">{agent}</div>}
          <div className="flex items-center gap-2">
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => (state === "idle" ? start().catch((e) => alert(e.message)) : stop())}
              className={cn("flex items-center gap-2 rounded-inputs px-4 py-2 text-body", state === "idle" ? "bg-ink text-parchment" : "border border-warm-mist text-ink")}
            >
              {state === "idle" ? <Mic size={16} /> : <MicOff size={16} />}
              {state === "idle" ? "Bắt đầu" : "Kết thúc"}
            </motion.button>
            {ptt && (
              <motion.button
                whileTap={{ scale: 0.95 }}
                onPointerDown={pttDown}
                onPointerUp={pttUp}
                onPointerLeave={pttUp}
                className="flex items-center gap-2 rounded-inputs bg-deep-teal px-4 py-2 text-body text-white"
              >
                <Square size={12} fill="currentColor" /> Giữ để nói
              </motion.button>
            )}
          </div>
          <div className="text-center text-caption text-ash">
            STT: {stt}
            <br />
            TTS: Kokoro-Vietnamese (local) · LLM: Gemini 3.5 Flash-Lite
          </div>
        </div>

        <div className="flex min-h-[320px] flex-col rounded-cards border border-hairline bg-soft-paper">
          <div className="scrollbar-thin flex-1 space-y-3 overflow-y-auto p-4">
            {!lines.length && <p className="text-body text-graphite">Ví dụ: “Điểm chuẩn ngành Kỹ thuật Máy tính năm 2026 là bao nhiêu?”</p>}
            {lines.map((l, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={spring} className={cn("max-w-[85%] text-body-lg", l.role === "user" ? "ml-auto text-right" : "")}>
                <span className={cn("inline-block rounded-cards px-3.5 py-2", l.role === "user" ? "bg-hairline text-ink" : "text-ink", l.partial && "text-graphite")}>{l.text}</span>
              </motion.div>
            ))}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendText();
            }}
            className="flex items-center gap-2 border-t border-hairline p-2"
          >
            <Keyboard size={16} className="ml-2 text-graphite" />
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              disabled={state === "idle"}
              placeholder={state === "idle" ? "Bắt đầu phiên để gõ hoặc nói" : "Hoặc gõ câu hỏi, BKAi sẽ đọc câu trả lời"}
              className="flex-1 bg-transparent px-1 py-1.5 text-body text-ink placeholder:text-graphite focus:outline-none"
            />
          </form>
        </div>
      </div>
      <p className="mt-3 text-caption text-ash">Âm thanh được xử lý trên máy chủ BKAi ({new URL(API_BASE).host}); không lưu bản ghi giọng nói.</p>
    </div>
  );
}
