#!/usr/bin/env bash
# Stop everything scripts/start.sh started (frontend, landing, backend, MCP server, voice worker).
#
#   scripts/stop.sh            stop BKAi, leave Redis running (other projects may use it)
#   scripts/stop.sh --redis    also stop Redis
#
# Also cleans up BKAi processes that still hold the ports without a PID file (e.g. started by hand),
# but only processes whose working directory is inside this project.
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
RUN="$ROOT/.run"
BACKEND_PORT="${BACKEND_PORT:-8000}"
FRONTEND_PORT="${FRONTEND_PORT:-5173}"
MCP_PORT="${MCP_PORT:-8765}"
LANDING_PORT="${LANDING_PORT:-5174}"
STOP_REDIS=0
for arg in "$@"; do
  case "$arg" in
    --redis) STOP_REDIS=1 ;;
    -h|--help) sed -n '2,8p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "Unknown option: $arg (see --help)"; exit 1 ;;
  esac
done

ok()   { printf '  \033[32m✓\033[0m %s\n' "$*"; }
skip() { printf '  \033[2m· %s\033[0m\n' "$*"; }

terminate() {  # terminate <pid>: SIGTERM, wait up to 10 s, then SIGKILL
  local pid=$1
  kill "$pid" 2>/dev/null || return 0
  for _ in $(seq 1 20); do kill -0 "$pid" 2>/dev/null || return 0; sleep 0.5; done
  kill -9 "$pid" 2>/dev/null || true
}

ours() {  # true if the process's working directory is inside this project
  local cwd
  cwd=$(lsof -a -p "$1" -d cwd -Fn 2>/dev/null | sed -n 's/^n//p')
  [[ "$cwd" == "$ROOT"* ]]
}

stop_service() {  # stop_service <name> <port|"">
  local name=$1 port=$2 stopped=0 f="$RUN/$1.pid"
  if [ -f "$f" ]; then
    local pid; pid=$(cat "$f")
    if kill -0 "$pid" 2>/dev/null; then terminate "$pid"; stopped=1; fi
    rm -f "$f"
  fi
  if [ -n "$port" ]; then
    for pid in $(lsof -nP -iTCP:"$port" -sTCP:LISTEN -t 2>/dev/null); do
      if ours "$pid"; then terminate "$pid"; stopped=1
      else skip "port $port is held by pid $pid ($(ps -o comm= -p "$pid")) outside BKAi — left alone"; fi
    done
  fi
  [ "$stopped" = 1 ] && ok "$name stopped" || skip "$name was not running"
}

echo "▸ Stopping BKAi"
stop_service frontend "$FRONTEND_PORT"
stop_service landing "$LANDING_PORT"
stop_service voice ""
stop_service mcp "$MCP_PORT"
stop_service backend "$BACKEND_PORT"

if [ "$STOP_REDIS" = 1 ]; then
  if command -v brew >/dev/null && brew services list 2>/dev/null | grep -q '^redis .*started'; then
    brew services stop redis >/dev/null 2>&1 && ok "Redis stopped"
  elif redis-cli ping >/dev/null 2>&1; then
    redis-cli shutdown >/dev/null 2>&1; ok "Redis stopped"
  else
    skip "Redis was not running"
  fi
else
  skip "Redis left running (scripts/stop.sh --redis to stop it)"
fi
echo "Done. Logs are kept in .run/logs/"
