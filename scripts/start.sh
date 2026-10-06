#!/usr/bin/env bash
# Start BKAi locally without Docker: Redis → backend (FastAPI + embedded Qdrant) → frontend (Vite).
# Everything runs in the background; logs and PIDs live in .run/. Stop with scripts/stop.sh.
#
#   scripts/start.sh               backend :8000 + frontend :5173
#   scripts/start.sh --open        … and open the browser
#   scripts/start.sh --mcp         … plus the MCP server (streamable HTTP :8765)
#   scripts/start.sh --voice       … plus the LiveKit voice worker (needs LIVEKIT_* in backend/.env)
#   scripts/start.sh --rebuild     re-crawl and rebuild the knowledge base first
#
# Ports: BACKEND_PORT=8000 FRONTEND_PORT=5173 MCP_PORT=8765 scripts/start.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
RUN="$ROOT/.run"
LOGS="$RUN/logs"
BACKEND_PORT="${BACKEND_PORT:-8000}"
FRONTEND_PORT="${FRONTEND_PORT:-5173}"
MCP_PORT="${MCP_PORT:-8765}"
OPEN=0 MCP=0 VOICE=0 REBUILD=0

for arg in "$@"; do
  case "$arg" in
    --open) OPEN=1 ;;
    --mcp) MCP=1 ;;
    --voice) VOICE=1 ;;
    --rebuild) REBUILD=1 ;;
    -h|--help) sed -n '2,11p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "Unknown option: $arg (see --help)"; exit 1 ;;
  esac
done

bold() { printf '\033[1m%s\033[0m\n' "$*"; }
ok()   { printf '  \033[32m✓\033[0m %s\n' "$*"; }
warn() { printf '  \033[33m!\033[0m %s\n' "$*"; }
die()  { printf '  \033[31m✗\033[0m %s\n' "$*"; exit 1; }

mkdir -p "$LOGS"

listener() { lsof -nP -iTCP:"$1" -sTCP:LISTEN -t 2>/dev/null | head -1 || true; }

running() {  # running <name> → true if .run/<name>.pid points at a live process
  local f="$RUN/$1.pid"
  [ -f "$f" ] && kill -0 "$(cat "$f")" 2>/dev/null
}

wait_http() {  # wait_http <url> <seconds> <pid>
  local url=$1 secs=$2 pid=$3
  for _ in $(seq 1 "$secs"); do
    curl -sf -o /dev/null "$url" && return 0
    kill -0 "$pid" 2>/dev/null || return 1
    sleep 1
  done
  return 1
}

# ── 1 · prerequisites ────────────────────────────────────────────────────────
bold "▸ Checking prerequisites"
[ -x "$ROOT/backend/.venv/bin/python" ] || die "backend/.venv missing — cd backend && python3.12 -m venv .venv && .venv/bin/pip install -r requirements.txt"
[ -f "$ROOT/backend/.env" ] || die "backend/.env missing — cp backend/.env.example backend/.env and set GOOGLE_API_KEY"
grep -Eq '^GOOGLE_API_KEY=.+' "$ROOT/backend/.env" || die "GOOGLE_API_KEY is empty in backend/.env"
grep -Eq '^ASSEMBLYAI_API_KEY=.+' "$ROOT/backend/.env" && ok "AssemblyAI key present (streaming voice)" || warn "ASSEMBLYAI_API_KEY empty — voice falls back to Whisper"
command -v npm >/dev/null || die "npm not found — install Node 20+"
if [ ! -d "$ROOT/frontend/node_modules" ]; then
  echo "  installing frontend packages…"
  (cd "$ROOT/frontend" && npm install --silent) || die "npm install failed"
fi
ok "Python venv, .env, Node"

# ── 2 · Redis ────────────────────────────────────────────────────────────────
bold "▸ Redis"
if redis-cli ping >/dev/null 2>&1; then
  ok "already running on :6379"
else
  if command -v brew >/dev/null; then
    brew services start redis >/dev/null 2>&1 || true
  elif command -v redis-server >/dev/null; then
    redis-server --daemonize yes >/dev/null
  fi
  for _ in $(seq 1 10); do redis-cli ping >/dev/null 2>&1 && break; sleep 1; done
  redis-cli ping >/dev/null 2>&1 && ok "started on :6379" \
    || warn "Redis not available — backend falls back to in-memory sessions (lost on restart)"
fi

# ── 3 · knowledge base ───────────────────────────────────────────────────────
cd "$ROOT/backend"
PY="$ROOT/backend/.venv/bin/python"
if [ "$REBUILD" = 1 ] || [ ! -f data/build/facts.sqlite ] || [ ! -d data/build/qdrant ]; then
  if running backend; then die "backend is running and holds the Qdrant index — run scripts/stop.sh before --rebuild"; fi
  bold "▸ Building knowledge base (crawl → parse → validate → build → ingest, a few minutes)"
  "$PY" -m datahub all >"$LOGS/datahub.log" 2>&1 || die "datahub failed — see .run/logs/datahub.log"
  "$PY" ingest.py >"$LOGS/ingest.log" 2>&1 || die "ingest failed — see .run/logs/ingest.log"
  ok "knowledge base ready"
fi

# ── 4 · backend ──────────────────────────────────────────────────────────────
bold "▸ Backend  → http://localhost:$BACKEND_PORT"
if running backend; then
  ok "already running (pid $(cat "$RUN/backend.pid"))"
else
  pid=$(listener "$BACKEND_PORT"); [ -z "$pid" ] || die "port $BACKEND_PORT is used by pid $pid ($(ps -o comm= -p "$pid")) — run scripts/stop.sh or set BACKEND_PORT"
  nohup "$PY" -m uvicorn main:app --host 127.0.0.1 --port "$BACKEND_PORT" >"$LOGS/backend.log" 2>&1 &
  echo $! >"$RUN/backend.pid"
  echo "  loading embedding, reranker and TTS models (first start can take ~1 min)…"
  wait_http "http://127.0.0.1:$BACKEND_PORT/api/health" 240 "$(cat "$RUN/backend.pid")" \
    || { tail -20 "$LOGS/backend.log"; die "backend did not become healthy — see .run/logs/backend.log"; }
  ok "healthy (pid $(cat "$RUN/backend.pid"))"
fi

# ── 5 · frontend ─────────────────────────────────────────────────────────────
bold "▸ Frontend → http://localhost:$FRONTEND_PORT"
if running frontend; then
  ok "already running (pid $(cat "$RUN/frontend.pid"))"
else
  pid=$(listener "$FRONTEND_PORT"); [ -z "$pid" ] || die "port $FRONTEND_PORT is used by pid $pid ($(ps -o comm= -p "$pid")) — run scripts/stop.sh or set FRONTEND_PORT"
  cd "$ROOT/frontend"
  VITE_API_URL="http://localhost:$BACKEND_PORT" nohup ./node_modules/.bin/vite --port "$FRONTEND_PORT" --strictPort \
    >"$LOGS/frontend.log" 2>&1 &
  echo $! >"$RUN/frontend.pid"
  wait_http "http://localhost:$FRONTEND_PORT" 60 "$(cat "$RUN/frontend.pid")" \
    || { tail -20 "$LOGS/frontend.log"; die "frontend did not start — see .run/logs/frontend.log"; }
  ok "ready (pid $(cat "$RUN/frontend.pid"))"
  grep -Eq "^API_CORS_ORIGINS=.*localhost:$FRONTEND_PORT" "$ROOT/backend/.env" \
    || warn "add http://localhost:$FRONTEND_PORT to API_CORS_ORIGINS in backend/.env (WebSockets check the Origin)"
fi

# ── 6 · optional services ────────────────────────────────────────────────────
cd "$ROOT/backend"
if [ "$MCP" = 1 ]; then
  bold "▸ MCP server → http://127.0.0.1:$MCP_PORT"
  if running mcp; then ok "already running"; else
    nohup "$PY" mcp_server.py --http --port "$MCP_PORT" >"$LOGS/mcp.log" 2>&1 &
    echo $! >"$RUN/mcp.pid"; sleep 3
    running mcp && ok "started (pid $(cat "$RUN/mcp.pid"))" || warn "MCP server exited — see .run/logs/mcp.log"
  fi
  # embedded Qdrant allows one process per folder: the backend holds it, so MCP search needs the Qdrant server
  grep -Eq '^QDRANT_URL=.+' "$ROOT/backend/.env" \
    || warn "QDRANT_URL is empty: SQL tools work, but search_documents needs a Qdrant server (QDRANT_URL) while the backend runs"
fi
if [ "$VOICE" = 1 ]; then
  bold "▸ LiveKit voice worker"
  if running voice; then ok "already running"; else
    BKAI_BACKEND_URL="http://127.0.0.1:$BACKEND_PORT" nohup "$PY" -m agents.voice_livekit dev >"$LOGS/voice.log" 2>&1 &
    echo $! >"$RUN/voice.pid"; sleep 3
    running voice && ok "started (pid $(cat "$RUN/voice.pid"))" || warn "voice worker exited — see .run/logs/voice.log"
  fi
fi

echo
bold "BKAi is up"
echo "  Landing        http://localhost:$FRONTEND_PORT
  App (chat)     http://localhost:$FRONTEND_PORT/chat   (Observability: activity icon, top right)"
echo "  API health     http://localhost:$BACKEND_PORT/api/health"
echo "  Logs           tail -f .run/logs/backend.log"
echo "  Stop           scripts/stop.sh"
[ "$OPEN" = 1 ] && command -v open >/dev/null && open "http://localhost:$FRONTEND_PORT"
exit 0
