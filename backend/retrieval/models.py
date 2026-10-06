"""Embedding + cross-encoder models (lazy singletons, thread-safe, device auto-selection)."""

from __future__ import annotations

import threading
from functools import lru_cache

import numpy as np

from config.settings import get_settings
from utils.logger import get_logger

logger = get_logger(__name__)
_model_lock = threading.Lock()  # torch modules are not re-entrant across threads on MPS


def pick_device(pref: str = "auto") -> str:
    if pref != "auto":
        return pref
    import torch

    if torch.cuda.is_available():
        return "cuda"
    if torch.backends.mps.is_available():
        return "mps"
    return "cpu"


@lru_cache(maxsize=4)
def get_embedder(model_name: str | None = None):
    from sentence_transformers import SentenceTransformer

    s = get_settings().embedding
    name = model_name or s.model
    device = pick_device(s.device)
    model = SentenceTransformer(name, device=device)
    model.max_seq_length = s.max_seq_length
    logger.info("embedder_loaded", model=name, device=device, dim=model.get_embedding_dimension())
    return model


def embed(texts: list[str], model_name: str | None = None, batch_size: int | None = None) -> np.ndarray:
    model = get_embedder(model_name)
    with _model_lock:
        return model.encode(
            texts,
            batch_size=batch_size or get_settings().embedding.batch_size,
            normalize_embeddings=True,
            convert_to_numpy=True,
            show_progress_bar=False,
        )


@lru_cache(maxsize=4)
def get_reranker(model_name: str | None = None, max_length: int | None = None):
    from sentence_transformers import CrossEncoder

    s = get_settings().reranker
    name = model_name or s.model
    device = pick_device(get_settings().embedding.device)
    model = CrossEncoder(name, max_length=max_length or s.max_length, device=device)
    logger.info("reranker_loaded", model=name, device=device)
    return model


def rerank_scores(query: str, passages: list[str], model_name: str | None = None,
                  max_length: int | None = None) -> list[float]:
    if not passages:
        return []
    model = get_reranker(model_name, max_length)
    with _model_lock:
        scores = model.predict([(query, p) for p in passages], batch_size=16, show_progress_bar=False)
    scores = np.asarray(scores, dtype=float)
    if scores.min() < 0 or scores.max() > 1:  # raw logits → probability
        scores = 1 / (1 + np.exp(-scores))
    return scores.tolist()


def warmup() -> None:
    embed(["khởi động mô hình"])
    if get_settings().reranker.enabled:
        rerank_scores("khởi động", ["mô hình xếp hạng"])
