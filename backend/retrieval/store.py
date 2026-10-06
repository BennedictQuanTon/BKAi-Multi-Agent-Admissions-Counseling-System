"""Qdrant access: embedded local mode for dev (no Docker) or server mode via QDRANT_URL."""

from __future__ import annotations

import threading
from functools import lru_cache

from qdrant_client import QdrantClient, models

from config.settings import get_settings
from utils.logger import get_logger

logger = get_logger(__name__)
DENSE = "dense"
SPARSE = "bm25"
_lock = threading.Lock()  # embedded mode is not safe for concurrent writers


@lru_cache(maxsize=1)
def get_client() -> QdrantClient:
    q = get_settings().qdrant
    if q.url:
        client = QdrantClient(url=q.url, api_key=q.api_key or None, timeout=10)
        logger.info("qdrant_server", url=q.url)
    else:
        client = QdrantClient(path=q.path)
        logger.info("qdrant_embedded", path=q.path)
    return client


def recreate_collection(name: str, dim: int) -> None:
    client = get_client()
    if client.collection_exists(name):
        client.delete_collection(name)
    client.create_collection(
        name,
        vectors_config={DENSE: models.VectorParams(size=dim, distance=models.Distance.COSINE)},
        sparse_vectors_config={SPARSE: models.SparseVectorParams(modifier=models.Modifier.IDF)},
    )
    for field_name, schema in (("doc_id", models.PayloadSchemaType.KEYWORD),
                               ("source_type", models.PayloadSchemaType.KEYWORD),
                               ("program_id", models.PayloadSchemaType.KEYWORD),
                               ("major_codes", models.PayloadSchemaType.KEYWORD),
                               ("topic", models.PayloadSchemaType.KEYWORD),
                               ("year", models.PayloadSchemaType.INTEGER)):
        try:
            client.create_payload_index(name, field_name, schema)
        except Exception:  # payload indexes are a no-op in embedded mode
            pass


def upsert(name: str, points: list[models.PointStruct], batch: int = 128) -> None:
    client = get_client()
    with _lock:
        for i in range(0, len(points), batch):
            client.upsert(name, points[i:i + batch], wait=True)


def hybrid_query(
    name: str,
    dense: list[float],
    sparse_idx: list[int],
    sparse_val: list[float],
    limit: int,
    prefetch_k: int,
    flt: models.Filter | None = None,
) -> list[models.ScoredPoint]:
    """Dense + BM25 candidates fused with Reciprocal Rank Fusion inside Qdrant."""
    client = get_client()
    prefetch = [
        models.Prefetch(query=dense, using=DENSE, limit=prefetch_k, filter=flt),
        models.Prefetch(query=models.SparseVector(indices=sparse_idx, values=sparse_val), using=SPARSE,
                        limit=prefetch_k, filter=flt),
    ]
    with _lock:
        res = client.query_points(name, prefetch=prefetch, query=models.FusionQuery(fusion=models.Fusion.RRF),
                                  limit=limit, with_payload=True)
    return res.points


def dense_query(name: str, dense: list[float], limit: int, flt: models.Filter | None = None):
    with _lock:
        return get_client().query_points(name, query=dense, using=DENSE, limit=limit, query_filter=flt,
                                         with_payload=True).points


def sparse_query(name: str, idx: list[int], val: list[float], limit: int, flt: models.Filter | None = None):
    with _lock:
        return get_client().query_points(name, query=models.SparseVector(indices=idx, values=val), using=SPARSE,
                                         limit=limit, query_filter=flt, with_payload=True).points
