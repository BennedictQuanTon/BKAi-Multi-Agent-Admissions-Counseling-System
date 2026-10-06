"""
Entity-guarded semantic answer cache (Qdrant collection).

A cached answer is served only if ALL hold:
  1. the owner approved it (status = approved — cache hits never self-approve),
  2. the knowledge-base version is unchanged (re-ingest invalidates everything),
  3. the resolved entity signature (majors, programs, years, methods) is identical,
  4. cosine(query, cached query) ≥ CACHE_THRESHOLD.
Rule 3 is what prevents "KTMT 2025" from returning the cached "KHMT 2025" answer.
"""

from __future__ import annotations

import json
import time
import uuid
from functools import lru_cache

from qdrant_client import models

from config.settings import get_settings
from knowledge.facts import resolve
from retrieval import store
from retrieval.models import embed, get_embedder
from utils.logger import get_logger

logger = get_logger(__name__)


@lru_cache(maxsize=1)
def kb_version() -> str:
    path = get_settings().manifest_path
    return json.loads(path.read_text(encoding="utf-8")).get("kb_version", "dev") if path.exists() else "dev"


def _collection() -> str:
    name = get_settings().qdrant.cache_collection
    client = store.get_client()
    if not client.collection_exists(name):
        client.create_collection(name, vectors_config=models.VectorParams(
            size=get_embedder().get_embedding_dimension(), distance=models.Distance.COSINE))
    return name


def entity_key(query: str) -> str:
    return resolve(query).key()


def lookup(query: str) -> dict | None:
    s = get_settings().cache
    if not s.enabled:
        return None
    try:
        flt = models.Filter(must=[
            models.FieldCondition(key="status", match=models.MatchValue(value="approved")),
            models.FieldCondition(key="kb_version", match=models.MatchValue(value=kb_version())),
            models.FieldCondition(key="entity_key", match=models.MatchValue(value=entity_key(query))),
        ])
        with store._lock:
            pts = store.get_client().query_points(_collection(), query=embed([query])[0].tolist(), query_filter=flt,
                                                  limit=1, with_payload=True).points
        if pts and pts[0].score >= s.threshold:
            p = pts[0].payload
            return {"answer": p["answer"], "sources": p.get("sources", []), "similarity": round(pts[0].score, 4),
                    "cached_query": p["query"], "cache_id": str(pts[0].id)}
    except Exception as e:  # noqa: BLE001 — cache must never break the request path
        logger.warning("cache_lookup_failed", error=str(e))
    return None


def put(question_id: str, query: str, answer: str, sources: list[dict]) -> None:
    try:
        point = models.PointStruct(
            id=str(uuid.uuid5(uuid.NAMESPACE_URL, question_id)),
            vector=embed([query])[0].tolist(),
            payload={"question_id": question_id, "query": query, "answer": answer, "sources": sources,
                     "entity_key": entity_key(query), "kb_version": kb_version(), "status": "pending",
                     "created_at": time.time()},
        )
        with store._lock:
            store.get_client().upsert(_collection(), [point])
    except Exception as e:  # noqa: BLE001
        logger.warning("cache_put_failed", error=str(e))


def set_status(question_id: str, status: str) -> bool:
    """status: approved | rejected — called from the owner dashboard."""
    pid = str(uuid.uuid5(uuid.NAMESPACE_URL, question_id))
    try:
        with store._lock:
            client = store.get_client()
            if not client.retrieve(_collection(), [pid]):
                return False
            client.set_payload(_collection(), {"status": status}, points=[pid])
        return True
    except Exception as e:  # noqa: BLE001
        logger.warning("cache_status_failed", error=str(e))
        return False


def delete(question_id: str) -> None:
    pid = str(uuid.uuid5(uuid.NAMESPACE_URL, question_id))
    with store._lock:
        store.get_client().delete(_collection(), points_selector=models.PointIdsList(points=[pid]))
