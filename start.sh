#!/usr/bin/env bash
# BKAi — start everything locally (no Docker), in the background:
#   Redis → backend (API + chat + voice + MCP at /mcp) → frontend (landing + app) → LiveKit voice worker (if configured)
#
#   ./start.sh              start, then open the browser
#   ./start.sh --rebuild    re-crawl hcmut.edu.vn and rebuild the knowledge base first
#   ./stop.sh               stop everything
#
# Logs: .run/logs/*.log · PIDs: .run/*.pid
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
RUN="$ROOT/.run"; LOGS="$RUN/logs"; mkdir -p "$LOGS"
PY="$ROOT/backend/.venv/bin/python"
REBUILD=0; [ "${1:-}" = "--rebuild" ] && REBUILD=1

ok()   { printf '  \033[32m✓\033[0m %s\n' "$*"; }
note() { printf '  \033[2m· %s\033[0m\n' "$*"; }
die()  { printf '  \033[31m✗\033[0m %s\n' "$*"; exit 1; }
alive() { [ -f "$RUN/$1.pid" ] && kill -0 "$(cat "$RUN/$1.pid")" 2>/dev/null; }
port_free() { ! lsof -nP -iTCP:"$1" -sTCP:LISTEN -t >/dev/null 2>&1; }
wait_url() {  # wait_url <url> <seconds> <pid>
  for _ in $(seq 1 "$2"); do curl -sf -o /dev/null "$1" && return 0; kill -0 "$3" 2>/dev/null || return 1; sleep 1; done; return 1
}
launch() {  # launch <name> <log> <command…>  (runs in the background, remembers the pid)
  local name=$1 log=$2; shift 2
  nohup "$@" >"$LOGS/$log" 2>&1 &
  echo $! >"$RUN/$name.pid"
}
has_env() { grep -Eq "^$1=.+" "$ROOT/backend/.env"; }

echo "BKAi · starting"

# 1 · checks (secrets are only tested for presence, never printed)
[ -x "$PY" ] || die "backend/.venv missing → cd backend && python3.12 -m venv .venv && .venv/bin/pip install -r requirements.txt"
[ -f "$ROOT/backend/.env" ] || die "backend/.env missing → cp backend/.env.example backend/.env and set GOOGLE_API_KEY"
has_env GOOGLE_API_KEY || die "GOOGLE_API_KEY is empty in backend/.env"
[ -d "$ROOT/frontend/node_modules" ] || (cd "$ROOT/frontend" && npm install --silent) || die "npm install failed"

# 2 · Redis
if ! redis-cli ping >/dev/null 2>&1; then
  (command -v brew >/dev/null && brew services start redis >/dev/null 2>&1) || redis-server --daemonize yes >/dev/null 2>&1 || true
  for _ in $(seq 1 10); do redis-cli ping >/dev/null 2>&1 && break; sleep 1; done
fi
redis-cli ping >/dev/null 2>&1 && ok "Redis :6379" || note "Redis not running — sessions fall back to memory"

# 3 · knowledge base (first run or --rebuild)
cd "$ROOT/backend"
if [ "$REBUILD" = 1 ] || [ ! -f data/build/facts.sqlite ] || [ ! -d data/build/qdrant ]; then
  alive backend && die "stop the backend first (./stop.sh) — it holds the Qdrant index"
  echo "  building the knowledge base (crawl → validate → index, a few minutes)…"
  "$PY" -m datahub all >"$LOGS/datahub.log" 2>&1 || die "datahub failed → .run/logs/datahub.log"
  "$PY" ingest.py >"$LOGS/ingest.log" 2>&1 || die "ingest failed → .run/logs/ingest.log"
  ok "knowledge base"
fi

# 4 · backend: REST + /ws/chat + /ws/voice (AssemblyAI + Kokoro) + MCP at /mcp
if alive backend; then ok "backend already running"; else
  port_free 8000 || die "port 8000 is busy → ./stop.sh"
  launch backend backend.log "$PY" -m uvicorn main:app --host 127.0.0.1 --port 8000
  echo "  loading models (embedding, reranker, Kokoro)…"
  wait_url http://127.0.0.1:8000/api/health 240 "$(cat "$RUN/backend.pid")" || { tail -15 "$LOGS/backend.log"; die "backend failed → .run/logs/backend.log"; }
  ok "backend :8000  (chat · voice · MCP /mcp)"
fi

# 5 · frontend: landing at /, app at /chat
if alive frontend; then ok "frontend already running"; else
  port_free 5173 || die "port 5173 is busy → ./stop.sh"
  cd "$ROOT/frontend"
  launch frontend frontend.log env VITE_API_URL=http://localhost:8000 ./node_modules/.bin/vite --port 5173 --strictPort
  wait_url http://localhost:5173 60 "$(cat "$RUN/frontend.pid")" || die "frontend failed → .run/logs/frontend.log"
  ok "frontend :5173"
fi

# 6 · LiveKit realtime voice worker (WebRTC / phone) — only when LIVEKIT_* is set
cd "$ROOT/backend"
if has_env LIVEKIT_URL && has_env LIVEKIT_API_KEY && has_env LIVEKIT_API_SECRET; then
  if alive voice; then ok "LiveKit worker already running"; else
    launch voice voice.log env BKAI_BACKEND_URL=http://127.0.0.1:8000 "$PY" -m agents.voice_livekit start
    sleep 4; alive voice && ok "LiveKit voice worker" || note "LiveKit worker exited → .run/logs/voice.log (in-app voice still works)"
  fi
else
  note "LiveKit not configured — in-app voice (AssemblyAI + Kokoro) is on"
fi
has_env ASSEMBLYAI_API_KEY && ok "voice STT: AssemblyAI streaming (Whisper fallback stays off)" || note "ASSEMBLYAI_API_KEY empty → voice uses Whisper"

cat <<EOF

BKAi is up
  Landing        http://localhost:5173
  App            http://localhost:5173/chat      (Observability: activity icon, top right)
  Voice          http://localhost:5173/voice
  Dashboard      http://localhost:5173/dashboard
  API            http://localhost:8000/api/health · docs http://localhost:8000/docs
  MCP            http://127.0.0.1:8000/mcp       (streamable HTTP; stdio: backend/.venv/bin/python backend/mcp_server.py)
  Logs           tail -f .run/logs/backend.log
  Stop           ./stop.sh
EOF
[ -n "${BKAI_NO_OPEN:-}" ] || { command -v open >/dev/null && open "http://localhost:5173"; } || true
