"""BKAi v5 — Multi-Agent Agentic RAG admissions counsellor for HCMUT."""

from __future__ import annotations

import asyncio
import os
from contextlib import asynccontextmanager

os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")

from fastapi import FastAPI  # noqa: E402
from fastapi.middleware.cors import CORSMiddleware  # noqa: E402

from config.settings import get_settings  # noqa: E402
from utils.logger import get_logger, setup_logging  # noqa: E402

logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    s = get_settings()
    setup_logging("DEBUG" if s.api.debug else "INFO")
    if s.app.production and not s.security.admin_token:
        raise RuntimeError("APP_ENV=production requires ADMIN_TOKEN (protects admin + observability endpoints)")
    logger.info("bkai_startup", version=s.app.version, llm=s.gemini.model_primary, embedding=s.embedding.model)
    from knowledge.facts import latest_year
    from retrieval.models import warmup
    from workflows.graph import get_graph

    latest_year()               # fail fast if facts.sqlite is missing
    await asyncio.to_thread(warmup)  # embedder + reranker on MPS/CUDA/CPU — no cold first request
    from memory.answer_cache import _collection
    from services.audio_service import warmup_tts

    await asyncio.to_thread(warmup_tts)  # Kokoro TTS (~10 s on CPU) — before "ready", not during the first request
    await asyncio.to_thread(_collection)
    get_graph()
    logger.info("bkai_ready")
    yield
    from retrieval.store import get_client

    get_client().close()


def create_app() -> FastAPI:
    s = get_settings()
    docs = not s.app.production
    app = FastAPI(title=f"{s.app.name} — Tư vấn tuyển sinh ĐH Bách khoa ĐHQG-HCM", version=s.app.version,
                  lifespan=lifespan, docs_url="/docs" if docs else None, redoc_url=None,
                  openapi_url="/openapi.json" if docs else None)
    from api.security import SecurityMiddleware

    app.add_middleware(SecurityMiddleware)
    app.add_middleware(CORSMiddleware, allow_origins=s.api.cors_origin_list, allow_credentials=False,
                       allow_methods=["GET", "POST"], allow_headers=["Content-Type", "X-Admin-Token"])
    from api.routes import router
    from api.voice import voice_router
    from api.websocket import ws_router

    app.include_router(router)
    app.include_router(ws_router)
    app.include_router(voice_router)
    return app


app = create_app()

if __name__ == "__main__":
    import uvicorn

    s = get_settings()
    uvicorn.run("main:app", host=s.api.host, port=s.api.port, log_level="info")
