"""Hybrid search entry point used by the Policy-RAG agent, the MCP server and the benchmarks."""

from __future__ import annotations

import time
from dataclasses import dataclass, field
from typing import Literal

from qdrant_client import models

from config.settings import get_settings
from retrieval import sparse, store
from retrieval.models import embed, rerank_scores

Mode = Literal["dense", "sparse", "hybrid", "hybrid_rerank"]
SOURCE_PRIORITY = {"official": 0, "generated_from_official": 1, "legacy_v4": 2}


@dataclass
class Hit:
    id: str
    doc_id: str
    title: str
    section: str
    text: str
    parent_text: str
    source_url: str
    source_type: str
    score: float
    rank_fused: int
    meta: dict = field(default_factory=dict)

    @property
    def embed_text(self) -> str:
        return f"{self.title} › {self.section}\n{self.text}" if self.section else f"{self.title}\n{self.text}"

    def to_dict(self) -> dict:
        return {"doc_id": self.doc_id, "title": self.title, "section": self.section, "text": self.text,
                "source_url": self.source_url, "source_type": self.source_type, "score": round(self.score, 4)}


def _filter(program_ids: list[str] | None, source_types: list[str] | None) -> models.Filter | None:
    must = []
    if program_ids:
        must.append(models.FieldCondition(key="program_id", match=models.MatchAny(any=program_ids)))
    if source_types:
        must.append(models.FieldCondition(key="source_type", match=models.MatchAny(any=source_types)))
    return models.Filter(must=must) if must else None


def _to_hit(p, rank: int) -> Hit:
    pl = p.payload or {}
    return Hit(id=str(p.id), doc_id=pl.get("doc_id", ""), title=pl.get("title", ""), section=pl.get("section", ""),
               text=pl.get("text", ""), parent_text=pl.get("parent_text", ""), source_url=pl.get("source_url", ""),
               source_type=pl.get("source_type", ""), score=float(p.score or 0.0), rank_fused=rank,
               meta={k: pl.get(k) for k in ("topic", "year", "program_id", "major_codes")})


def search(
    query: str,
    mode: Mode = "hybrid_rerank",
    top_k: int | None = None,
    program_ids: list[str] | None = None,
    source_types: list[str] | None = None,
    timings: dict | None = None,
    *,
    collection: str | None = None,
    embed_model: str | None = None,
    reranker_model: str | None = None,
    reranker_max_length: int | None = None,
    rerank_candidates: int | None = None,
) -> list[Hit]:
    s = get_settings()
    k = top_k or s.search.top_k
    col = collection or s.qdrant.collection
    flt = _filter(program_ids, source_types)
    t0 = time.perf_counter()

    dense_vec = embed([query], model_name=embed_model)[0].tolist() if mode != "sparse" else None
    idx, val = sparse.query_vector(query)
    t1 = time.perf_counter()

    n_candidates = max(k, rerank_candidates or s.search.rerank_candidates) if mode == "hybrid_rerank" else k
    if mode == "dense":
        points = store.dense_query(col, dense_vec, n_candidates, flt)
    elif mode == "sparse":
        points = store.sparse_query(col, idx, val, n_candidates, flt)
    else:
        points = store.hybrid_query(col, dense_vec, idx, val, n_candidates, s.search.prefetch_k, flt)
    hits = [_to_hit(p, i + 1) for i, p in enumerate(points)]
    t2 = time.perf_counter()

    if mode == "hybrid_rerank" and hits and s.reranker.enabled:
        scores = rerank_scores(query, [h.embed_text for h in hits], reranker_model, reranker_max_length)
        for h, sc in zip(hits, scores):
            h.score = sc
        hits.sort(key=lambda h: (-round(h.score, 3), SOURCE_PRIORITY.get(h.source_type, 9)))
    t3 = time.perf_counter()

    seen_parents: set[str] = set()
    out: list[Hit] = []
    for h in hits:  # one child per parent section keeps the context diverse
        key = h.parent_text[:200]
        if key in seen_parents:
            continue
        seen_parents.add(key)
        out.append(h)
        if len(out) >= k:
            break
    if timings is not None:
        timings.update({"embed_ms": round((t1 - t0) * 1000, 1), "qdrant_ms": round((t2 - t1) * 1000, 1),
                        "rerank_ms": round((t3 - t2) * 1000, 1)})
    return out
