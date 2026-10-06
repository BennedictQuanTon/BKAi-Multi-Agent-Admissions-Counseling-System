#!/usr/bin/env bash
# BKAi — stop everything ./start.sh started. Redis keeps running (other projects may use it); ./stop.sh --redis stops it too.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
RUN="$ROOT/.run"

stop() {  # stop <name> <port|"">: by pid file, then any BKAi process still holding the port
  local name=$1 port=$2 done=0
  if [ -f "$RUN/$name.pid" ]; then
    local pid; pid=$(cat "$RUN/$name.pid"); rm -f "$RUN/$name.pid"
    if kill "$pid" 2>/dev/null; then
      for _ in $(seq 1 20); do kill -0 "$pid" 2>/dev/null || break; sleep 0.5; done
      kill -9 "$pid" 2>/dev/null; done=1
    fi
  fi
  if [ -n "$port" ]; then
    for pid in $(lsof -nP -iTCP:"$port" -sTCP:LISTEN -t 2>/dev/null); do
      [[ "$(lsof -a -p "$pid" -d cwd -Fn 2>/dev/null | sed -n 's/^n//p')" == "$ROOT"* ]] && kill "$pid" 2>/dev/null && done=1
    done
  fi
  [ "$done" = 1 ] && printf '  \033[32m✓\033[0m %s stopped\n' "$name" || printf '  \033[2m· %s was not running\033[0m\n' "$name"
}

echo "BKAi · stopping"
stop voice ""
stop frontend 5173
stop backend 8000
if [ "${1:-}" = "--redis" ]; then
  (command -v brew >/dev/null && brew services stop redis >/dev/null 2>&1) || redis-cli shutdown >/dev/null 2>&1
  printf '  \033[32m✓\033[0m Redis stopped\n'
fi
