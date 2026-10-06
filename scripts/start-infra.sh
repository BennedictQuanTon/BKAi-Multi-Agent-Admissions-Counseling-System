#!/usr/bin/env bash
# Redis + Qdrant via Docker (optional — the backend also runs with local Redis + embedded Qdrant).
set -euo pipefail
cd "$(dirname "$0")/.."
docker compose up -d redis qdrant
echo "Redis :6379 · Qdrant :6333 — set QDRANT_URL=http://localhost:6333 in backend/.env to use the server."
