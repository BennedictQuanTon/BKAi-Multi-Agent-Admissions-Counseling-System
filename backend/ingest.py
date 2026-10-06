#!/usr/bin/env python3
"""BKAi ingestion: curated documents → contextual chunks → dense + BM25 sparse vectors → Qdrant."""

from __future__ import annotations

import argparse
import json
import os
import time

os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")

from qdrant_client import models  # noqa: E402

from config.settings import get_settings  # noqa: E402
from retrieval import sparse, store  # noqa: E402
from retrieval.chunking import chunk_corpus  # noqa: E402
from retrieval.models import embed, get_embedder  # noqa: E402
from utils.logger import get_logger, setup_logging  # noqa: E402

setup_logging("INFO")
logger = get_logger("ingest")


def run(collection: str | None = None, model: str | None = None) -> dict:
    s = get_settings()
    t0 = time.time()
    manifest = json.loads(s.manifest_path.read_text(encoding="utf-8")) if s.manifest_path.exists() else {}
    kb_version = manifest.get("kb_version", "dev")

    chunks = chunk_corpus()
    texts = [c.embed_text for c in chunks]
    dense = embed(texts, model_name=model, batch_size=s.embedding.batch_size)
    avg_len = sparse.avg_doc_len(texts)

    name = collection or s.qdrant.collection
    store.recreate_collection(name, dim=get_embedder(model).get_embedding_dimension())
    points = []
    for c, vec, text in zip(chunks, dense, texts):
        idx, val = sparse.doc_vector(text, avg_len)
        points.append(models.PointStruct(
            id=c.id,
            vector={store.DENSE: vec.tolist(), store.SPARSE: models.SparseVector(indices=idx, values=val)},
            payload={"doc_id": c.doc_id, "title": c.title, "section": c.section, "text": c.text,
                     "parent_text": c.parent_text, "kb_version": kb_version, **c.meta},
        ))
    store.upsert(name, points)
    stats = {"collection": name, "chunks": len(chunks), "dim": int(dense.shape[1]), "avg_tokens": round(avg_len, 1),
             "kb_version": kb_version, "model": model or s.embedding.model, "seconds": round(time.time() - t0, 1)}
    logger.info("ingest_complete", **stats)
    return stats


def main() -> None:
    parser = argparse.ArgumentParser(description="BKAi ingestion → Qdrant")
    parser.add_argument("--collection", default=None)
    parser.add_argument("--model", default=None, help="override EMBEDDING_MODEL (benchmarks)")
    args = parser.parse_args()
    stats = run(args.collection, args.model)
    store.get_client().close()
    print("\n✓ Ingestion complete")
    for k, v in stats.items():
        print(f"  {k:12} {v}")


if __name__ == "__main__":
    main()
