"""BM25 as Qdrant sparse vectors: client-side TF saturation + server-side IDF modifier."""

from __future__ import annotations

import zlib
from collections import Counter

from knowledge.text import tokens

K1 = 1.2
B = 0.75


def _idx(token: str) -> int:
    return zlib.crc32(token.encode("utf-8")) & 0x7FFFFFFF


def doc_vector(text: str, avg_len: float) -> tuple[list[int], list[float]]:
    toks = tokens(text)
    dl = len(toks) or 1
    tf = Counter(_idx(t) for t in toks)
    norm = K1 * (1 - B + B * dl / max(avg_len, 1.0))
    items = sorted((i, c * (K1 + 1) / (c + norm)) for i, c in tf.items())
    return [i for i, _ in items], [v for _, v in items]


def query_vector(text: str) -> tuple[list[int], list[float]]:
    idx = sorted({_idx(t) for t in tokens(text)})
    return idx, [1.0] * len(idx)


def avg_doc_len(texts: list[str]) -> float:
    return sum(len(tokens(t)) for t in texts) / max(len(texts), 1)
