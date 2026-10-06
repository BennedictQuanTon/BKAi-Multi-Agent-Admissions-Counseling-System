"""
BKAi Backend Configuration.

Centralized settings via Pydantic BaseSettings. Every value can be overridden
through environment variables / backend/.env.
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parent.parent
PROJECT_ROOT = BACKEND_DIR.parent
ENV_FILE = str(BACKEND_DIR / ".env")

# ── Data layout (see backend/data/README.md) ──
DATA_DIR = BACKEND_DIR / "data"
SOURCES_DIR = DATA_DIR / "sources"          # raw crawl snapshots, one folder per date
CURATED_DIR = DATA_DIR / "curated"          # human-reviewable canonical data
STRUCTURED_DIR = CURATED_DIR / "structured"  # long-format CSV tables (facts)
DOCUMENTS_DIR = CURATED_DIR / "documents"    # markdown docs with YAML front-matter
LEGACY_DIR = DATA_DIR / "legacy"            # v4 knowledge base, kept for provenance
BUILD_DIR = DATA_DIR / "build"              # generated artifacts (sqlite, qdrant, manifest)


class GeminiSettings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="GEMINI_")

    model_primary: str = "gemini-3.5-flash-lite"
    model_fast: str = "gemini-3.5-flash-lite"
    # comma-separated; each model has its own per-minute quota, so the pool multiplies throughput
    model_fallbacks: str = "gemini-3.1-flash-lite"
    rpm_per_model: int = 14  # free tier = 15 RPM / model / project
    request_timeout: int = 30
    temperature_primary: float = 0.2
    temperature_fast: float = 0.0

    @property
    def fallback_list(self) -> list[str]:
        return [m.strip() for m in self.model_fallbacks.split(",") if m.strip()]


class GoogleSettings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="GOOGLE_")

    api_key: str = ""


class RedisSettings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="REDIS_")

    url: str = "redis://localhost:6379/0"
    prefix: str = "bkai"
    session_ttl: int = 60 * 60 * 24 * 7  # anonymous sessions: a returning student keeps context for a week


class QdrantSettings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="QDRANT_")

    # url wins when set (server mode, e.g. docker compose); otherwise embedded local mode.
    url: str = ""
    api_key: str = ""
    path: str = str(BUILD_DIR / "qdrant")
    collection: str = "bkai_knowledge"
    cache_collection: str = "bkai_answer_cache"


class EmbeddingSettings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="EMBEDDING_")

    model: str = "AITeamVN/Vietnamese_Embedding_v2"
    device: str = "auto"  # auto | cpu | mps | cuda
    batch_size: int = 16
    max_seq_length: int = 512


class RerankerSettings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="RERANKER_")

    model: str = "BAAI/bge-reranker-base"   # chosen by evaluation/run_retrieval_bench.py (Hit@1 0.875, p50 307 ms)
    max_length: int = 384
    enabled: bool = True


class SearchSettings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="SEARCH_")

    prefetch_k: int = Field(default=40, ge=1, le=200)
    rerank_candidates: int = Field(default=12, ge=1, le=100)
    top_k: int = Field(default=6, ge=1, le=30)
    min_rerank_score: float = Field(default=0.05, ge=0.0, le=1.0)


class CacheSettings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="CACHE_")

    enabled: bool = True
    threshold: float = Field(default=0.90, ge=0.5, le=1.0)
    ttl_seconds: int = 60 * 60 * 24 * 30


class SecuritySettings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="")

    rate_limit_per_minute: int = 30
    rate_limit_per_day: int = 400            # per IP — bounds LLM spend (OWASP LLM: unbounded consumption)
    max_ws_per_ip: int = 6
    max_input_length: int = 500
    max_body_bytes: int = 64_000
    voice_max_session_s: int = 600           # AssemblyAI bills per streamed second
    admin_token: str = ""                    # required in production: protects admin + observability
    trusted_proxies: str = ""                # comma-separated IPs allowed to set X-Forwarded-For


class GuardrailsSettings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="GUARDRAILS_")

    enabled: bool = True


class APISettings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="API_")

    host: str = "0.0.0.0"
    port: int = 8000
    cors_origins: str = "http://localhost:5173,http://localhost:4173"
    debug: bool = False

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


class AppSettings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="APP_")

    name: str = "BKAi"
    version: str = "5.0.0"
    env: str = "development"  # development | production

    @property
    def production(self) -> bool:
        return self.env.lower() == "production"


class VoiceSettings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="VOICE_")

    tts_provider: str = "kokoro"  # kokoro | edge | gemini — chosen by evaluation/run_tts_bench.py
    edge_voice: str = "vi-VN-HoaiMyNeural"
    kokoro_voice: str = "mai_linh"
    gemini_tts_model: str = "gemini-3.8-flash-lite-tts"
    gemini_tts_voice: str = "Kore"


class AssemblyAISettings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="ASSEMBLYAI_")

    api_key: str = ""
    speech_model: str = "universal-3-6-pro"
    sample_rate: int = 16000

    @property
    def enabled(self) -> bool:
        return bool(self.api_key)


class LiveKitSettings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="LIVEKIT_")

    url: str = ""
    api_key: str = ""
    api_secret: str = ""

    @property
    def enabled(self) -> bool:
        return bool(self.url and self.api_key and self.api_secret)


class LangfuseSettings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="LANGFUSE_")

    public_key: str = ""
    secret_key: str = ""
    host: str = "https://cloud.langfuse.com"

    @property
    def enabled(self) -> bool:
        return bool(self.public_key and self.secret_key)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=ENV_FILE,
        env_file_encoding="utf-8",
        extra="ignore",
    )

    google: GoogleSettings = Field(default_factory=GoogleSettings)
    gemini: GeminiSettings = Field(default_factory=GeminiSettings)
    redis: RedisSettings = Field(default_factory=RedisSettings)
    qdrant: QdrantSettings = Field(default_factory=QdrantSettings)
    embedding: EmbeddingSettings = Field(default_factory=EmbeddingSettings)
    reranker: RerankerSettings = Field(default_factory=RerankerSettings)
    search: SearchSettings = Field(default_factory=SearchSettings)
    cache: CacheSettings = Field(default_factory=CacheSettings)
    security: SecuritySettings = Field(default_factory=SecuritySettings)
    guardrails: GuardrailsSettings = Field(default_factory=GuardrailsSettings)
    api: APISettings = Field(default_factory=APISettings)
    app: AppSettings = Field(default_factory=AppSettings)
    voice: VoiceSettings = Field(default_factory=VoiceSettings)
    assemblyai: AssemblyAISettings = Field(default_factory=AssemblyAISettings)
    livekit: LiveKitSettings = Field(default_factory=LiveKitSettings)
    langfuse: LangfuseSettings = Field(default_factory=LangfuseSettings)

    @property
    def facts_db_path(self) -> Path:
        return BUILD_DIR / "facts.sqlite"

    @property
    def manifest_path(self) -> Path:
        return BUILD_DIR / "manifest.json"


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    from dotenv import load_dotenv

    load_dotenv(ENV_FILE, override=False)
    return Settings()
