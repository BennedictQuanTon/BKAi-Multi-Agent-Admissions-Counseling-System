// Production builds talk to the same origin (Caddy routes /api and /ws to the backend);
// `npm run dev` talks to the local API unless VITE_API_URL says otherwise.
export const API_BASE: string = import.meta.env.VITE_API_URL ?? (import.meta.env.DEV ? "http://localhost:8000" : "");
export const WS_BASE = API_BASE
  ? API_BASE.replace(/^http/, "ws")
  : `${typeof location !== "undefined" && location.protocol === "https:" ? "wss" : "ws"}://${typeof location !== "undefined" ? location.host : ""}`;

/* ── types ─────────────────────────────────────────────── */
export type TraceEvent = {
  type: "agent" | "tool";
  agent: string;
  status?: string;
  tool?: string;
  detail?: string;
  result?: string;
  args?: Record<string, unknown>;
  ms?: number;
  t_ms: number;
};

export type Source = { id: number; title: string; url: string; agent: string; kind: string };

export type Done = {
  type: "done";
  question_id: string;
  answer: string;
  route: string;
  cached: boolean;
  latency_ms: number;
  ttft_ms: number | null;
  sources: Source[];
  verification: { checked?: boolean; passed?: boolean; unsupported?: string[]; repaired?: boolean };
  timings?: Record<string, number>;
  llm_calls?: { node: string; model?: string; ms?: number }[];
  plan?: { scope?: string; intents?: string[]; resolved_query?: string; needs_clarification?: boolean };
};

export type ChatEvent =
  | { type: "token"; content: string; t_ms: number }
  | { type: "sources"; sources: Source[]; t_ms: number }
  | { type: "replace"; answer: string; t_ms: number }
  | (TraceEvent & { t_ms: number })
  | Done
  | { type: "error"; message: string };

/* ── anonymous, per-device memory ─────────────────────────────────────────────────────────────────
   No accounts. Each device keeps a random session id, the list of recent chats and their transcripts
   in localStorage; the server keeps the conversation memory and student profile in Redis (TTL). */
const SESSION_KEY = "bkai_session";
const HISTORY_KEY = "bkai_history";
const CHAT_PREFIX = "bkai_chat:";
const MAX_SESSIONS = 12;
const MAX_TURNS_KEPT = 30;

function safeGet(store: Storage, key: string): string | null {
  try {
    return store.getItem(key);
  } catch {
    return null;
  }
}
function safeSet(store: Storage, key: string, value: string) {
  try {
    store.setItem(key, value);
  } catch {
    /* private mode / blocked storage — the app works without it */
  }
}

function randomId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`; // non-secure contexts
  }
}

export function getSessionId(): string {
  let sid = safeGet(localStorage, SESSION_KEY) || safeGet(sessionStorage, SESSION_KEY);
  if (!sid) sid = randomId();
  safeSet(localStorage, SESSION_KEY, sid);
  return sid;
}

export function newSessionId(): string {
  const sid = randomId();
  safeSet(localStorage, SESSION_KEY, sid);
  return sid;
}

export type SavedTurn = { q: string; a: string; sources?: Source[] };

export function loadTranscript(sid: string): SavedTurn[] {
  try {
    return JSON.parse(safeGet(localStorage, CHAT_PREFIX + sid) || "[]");
  } catch {
    return [];
  }
}

export function saveTranscript(sid: string, turns: SavedTurn[]) {
  safeSet(localStorage, CHAT_PREFIX + sid, JSON.stringify(turns.slice(-MAX_TURNS_KEPT)));
}

/** Forget everything this device stored (for shared computers), and the server-side memory of those sessions. */
export async function clearDeviceData(): Promise<void> {
  const ids = new Set([...loadHistory().map((h) => h.id), safeGet(localStorage, SESSION_KEY) || ""].filter(Boolean));
  await Promise.allSettled([...ids].map((id) => api.clearSession(id)));
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith("bkai_") && k !== "bkai_admin")
      .forEach((k) => localStorage.removeItem(k));
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* storage blocked */
  }
  window.dispatchEvent(new Event("bkai-history"));
}

export type HistoryItem = { id: string; title: string; ts: number };

export function loadHistory(): HistoryItem[] {
  try {
    return JSON.parse(safeGet(localStorage, HISTORY_KEY) || "[]");
  } catch {
    return [];
  }
}

export function rememberSession(id: string, title: string) {
  const items = loadHistory().filter((h) => h.id !== id);
  items.unshift({ id, title: title.slice(0, 60), ts: Date.now() });
  const kept = items.slice(0, MAX_SESSIONS);
  safeSet(localStorage, HISTORY_KEY, JSON.stringify(kept));
  for (const old of items.slice(MAX_SESSIONS)) {
    try {
      localStorage.removeItem(CHAT_PREFIX + old.id);
    } catch {
      /* storage blocked */
    }
  }
  window.dispatchEvent(new Event("bkai-history"));
}

/* ── admin token (owner views: dashboard, observability) ── */
const ADMIN_KEY = "bkai_admin";
export function adminToken(): string {
  return safeGet(localStorage, ADMIN_KEY) || "";
}
export function setAdminToken(t: string) {
  safeSet(localStorage, ADMIN_KEY, t);
}
export class Unauthorized extends Error {}

/* ── REST ──────────────────────────────────────────────── */
async function json<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", "X-Admin-Token": adminToken(), ...(init?.headers || {}) },
  });
  if (res.status === 401) throw new Unauthorized("admin token required");
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return res.json() as Promise<T>;
}

export const api = {
  health: () => json<Record<string, unknown>>("/api/health"),
  stats: () => json<Stats>("/api/stats"),
  questions: (limit = 100) => json<{ items: QuestionRecord[] }>(`/api/questions?limit=${limit}`),
  kb: () => json<{ manifest: { kb_version?: string; built_at?: string; tables?: Record<string, number>; documents?: Record<string, number> }; latest_year: number }>("/api/kb"),
  evals: () => json<EvalReports>("/api/eval"),
  majors: () => json<{ majors: Major[]; programs: { program_id: string; name: string }[] }>("/api/majors"),
  session: (sid: string) => json<{ history: { role: string; content: string }[]; profile: Record<string, unknown> }>(`/api/session/${sid}`),
  clearSession: (sid: string) => json("/api/session/clear", { method: "POST", body: JSON.stringify({ session_id: sid }) }),
  feedback: (question_id: string, feedback: "like" | "dislike") =>
    json("/api/feedback", { method: "POST", body: JSON.stringify({ question_id, feedback }) }),
  review: (question_id: string, verdict: "correct" | "incorrect") =>
    json("/api/admin/review", { method: "POST", body: JSON.stringify({ question_id, verdict }) }),
  remove: (question_id: string) => json("/api/admin/delete", { method: "POST", body: JSON.stringify({ question_id }) }),
  observability: (limit: number) => json<unknown>(`/api/observability/overview?limit=${limit}`),
  observabilityQuery: (id: string) => json<unknown>(`/api/observability/query/${id}`),
  calc: (body: CalcInput) => json<CalcResult>("/api/tools/calc", { method: "POST", body: JSON.stringify(body) }),
};

export type Major = { major_id: string; major_code: string; program_id: string; name: string; is_new: number };

export type Stats = {
  total_questions: number;
  cache_hits: number;
  cache_hit_rate: number;
  latency_ms: { p50: number; p95: number; mean: number };
  ttft_ms: { p50: number; p95: number };
  cache_latency_ms: { p50: number };
  feedback: Record<string, number>;
  owner_accuracy: number | null;
  routes: Record<string, number>;
  verifier_pass_rate: number | null;
  avg_llm_calls: number;
  errors: number;
  active_sessions: number;
};

export type QuestionRecord = {
  id: string;
  query: string;
  answer: string;
  route: string;
  cached?: boolean;
  latency_ms: number;
  ttft_ms?: number | null;
  feedback: string;
  user_feedback?: string;
  ts: number;
  channel: string;
  verification?: { passed?: boolean; unsupported?: string[] };
  trace?: TraceEvent[];
  sources?: Source[];
  llm_calls?: { node: string; model?: string; ms?: number }[];
  error?: string;
};

export type EvalReports = {
  retrieval?: { config: string; "hit@1": number; "hit@5": number; "mrr@10": number; "ndcg@10": number; latency_ms_p50: number }[];
  e2e?: Record<string, unknown> & { summary?: Record<string, unknown> };
  tts?: { engine: string; ttfb_ms_p50?: number; total_ms_p50?: number; rtf_p50?: number; error?: string }[];
  tts_intelligibility?: { engine: string; cer_mean: number }[];
};

export type CalcInput = {
  thpt_math: number; thpt_subject2: number; thpt_subject3: number;
  hocba_math: number; hocba_subject2: number; hocba_subject3: number;
  dgnl: number | null; bonus_points: number; priority_points_30: number;
  program_ids: string[]; interests: string[];
};

export type CalcResult = {
  score: Record<string, number | string>;
  recommendations: {
    score: number; reference_year: number;
    results: { major_code: string; major_name: string; program_name: string; cutoff: number; prev_cutoff: number | null; delta: number; band: string; trend: number | null }[];
    disclaimer: string;
  };
};

/* ── streaming chat over one WebSocket per page ─────────── */
export class ChatSocket {
  private ws: WebSocket | null = null;
  private opening: Promise<WebSocket> | null = null;

  private open(): Promise<WebSocket> {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) return Promise.resolve(this.ws);
    if (this.opening) return this.opening;
    this.opening = new Promise((resolve, reject) => {
      const ws = new WebSocket(`${WS_BASE}/ws/chat`);
      ws.onopen = () => {
        this.ws = ws;
        this.opening = null;
        resolve(ws);
      };
      ws.onerror = () => {
        this.opening = null;
        reject(new Error("Không kết nối được tới máy chủ BKAi"));
      };
      ws.onclose = () => {
        this.ws = null;
      };
    });
    return this.opening;
  }

  async ask(query: string, sessionId: string, onEvent: (e: ChatEvent) => void): Promise<void> {
    const ws = await this.open();
    return new Promise((resolve) => {
      ws.onmessage = (msg) => {
        const ev = JSON.parse(msg.data) as ChatEvent;
        onEvent(ev);
        if (ev.type === "done" || ev.type === "error") resolve();
      };
      ws.send(JSON.stringify({ query, session_id: sessionId, channel: "chat" }));
    });
  }

  close() {
    this.ws?.close();
  }
}
