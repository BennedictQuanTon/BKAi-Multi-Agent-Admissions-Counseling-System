"""
Retrieval benchmark (no LLM calls): embedding × mode × reranker matrix on a labelled gold set.

Relevant chunk := chunk from one of the labelled docs that contains every `must` string.
Metrics: Hit@1/3/5, MRR@10, nDCG@10, latency p50/p95 (warm, single query).

    python -m evaluation.run_retrieval_bench            # full matrix
    python -m evaluation.run_retrieval_bench --quick    # production config only
"""

from __future__ import annotations

import argparse
import json
import math
import random
import statistics
import time
from datetime import datetime, timezone
from pathlib import Path

from config.settings import get_settings
from knowledge.facts import query as sql
from retrieval.chunking import chunk_corpus
from retrieval.search import search
from retrieval.store import get_client

HERE = Path(__file__).parent
GOLD = HERE / "datasets" / "retrieval_gold.json"
REPORT = HERE / "reports" / "retrieval_bench.json"

PROGRAM_PHRASE = {"tieu_chuan": "chương trình tiêu chuẩn", "tieng_anh": "học bằng tiếng Anh",
                  "dinh_huong_nhat": "định hướng Nhật Bản", "chuyen_tiep_quoc_te": "chuyển tiếp quốc tế du học Úc",
                  "lien_ket_tne": "liên kết UTS", "tien_tien": "chương trình tiên tiến",
                  "chuyen_tiep_nhat_ban": "chuyển tiếp Nhật Bản"}
TEMPLATES = ["ngành {name} {prog} học những gì, tổ hợp nào", "{name} {prog} có chuyên ngành gì",
             "tổ hợp xét tuyển ngành {name} hệ {prog}"]


def norm(s: str) -> str:
    return s.lower().replace("\\.", ".")


def load_cases(seed: int = 7, n_major: int = 30) -> list[dict]:
    cases = [{**c, "kind": "policy"} for c in json.loads(GOLD.read_text(encoding="utf-8"))]
    majors = sql("SELECT major_code, program_id, name FROM majors ORDER BY program_id, major_code")
    rng = random.Random(seed)
    for m in rng.sample(majors, n_major):
        q = rng.choice(TEMPLATES).format(name=m["name"].replace("Nhóm ngành ", "").replace("Chuyên ngành ", ""),
                                          prog=PROGRAM_PHRASE[m["program_id"]])
        cases.append({"q": q, "docs": [f"majors/{m['program_id']}-{m['major_code']}"], "must": [], "kind": "major"})
    return cases


def check_labels(cases: list[dict]) -> list[str]:
    chunks = chunk_corpus()
    bad = []
    for c in cases:
        if not any(ch.doc_id in c["docs"] and all(norm(m) in norm(ch.text) for m in c["must"]) for ch in chunks):
            bad.append(c["q"])
    return bad


def is_rel(hit, case) -> bool:
    return hit.doc_id in case["docs"] and all(norm(m) in norm(hit.text) for m in case["must"])


def metrics(ranks: list[list[bool]]) -> dict:
    n = len(ranks)
    first = [next((i + 1 for i, r in enumerate(rs) if r), None) for rs in ranks]
    hit = lambda k: sum(1 for f in first if f and f <= k) / n  # noqa: E731
    mrr = sum(1 / f for f in first if f and f <= 10) / n
    ndcg = 0.0
    for rs in ranks:
        dcg = sum(1 / math.log2(i + 2) for i, r in enumerate(rs[:10]) if r)
        ideal = sum(1 / math.log2(i + 2) for i in range(min(sum(rs), 10)))
        ndcg += dcg / ideal if ideal else 0.0
    return {"hit@1": round(hit(1), 3), "hit@3": round(hit(3), 3), "hit@5": round(hit(5), 3),
            "mrr@10": round(mrr, 3), "ndcg@10": round(ndcg / n, 3)}


def run_config(cases, name, **kw) -> dict:
    search(cases[0]["q"], **kw)  # warm-up (model load, MPS kernels)
    ranks, lat, misses = [], [], []
    for c in cases:
        t = time.perf_counter()
        hits = search(c["q"], top_k=10, **kw)
        lat.append((time.perf_counter() - t) * 1000)
        rel = [is_rel(h, c) for h in hits]
        ranks.append(rel)
        if not any(rel[:5]):
            misses.append(c["q"])
    out = {"config": name, **metrics(ranks),
           "by_kind": {k: metrics([r for r, c in zip(ranks, cases) if c["kind"] == k]) for k in ("policy", "major")},
           "latency_ms_p50": round(statistics.median(lat), 1),
           "latency_ms_p95": round(sorted(lat)[int(0.95 * (len(lat) - 1))], 1), "misses@5": misses}
    print(f"{name:58} hit@1={out['hit@1']:.3f} hit@5={out['hit@5']:.3f} mrr={out['mrr@10']:.3f} "
          f"ndcg={out['ndcg@10']:.3f} p50={out['latency_ms_p50']}ms")
    return out


def ensure_collection(model: str, collection: str) -> None:
    if not get_client().collection_exists(collection):
        import ingest

        ingest.run(collection, model)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--quick", action="store_true")
    args = ap.parse_args()
    s = get_settings()
    cases = load_cases()
    bad = check_labels(cases)
    if bad:
        raise SystemExit(f"Unsatisfiable gold labels: {bad}")
    print(f"{len(cases)} cases ({sum(c['kind'] == 'policy' for c in cases)} policy, "
          f"{sum(c['kind'] == 'major' for c in cases)} major) — labels verified\n")

    results = []
    if args.quick:
        results.append(run_config(cases, f"PROD {s.embedding.model} + {s.reranker.model}", mode="hybrid_rerank"))
    else:
        embeddings = {
            "minilm": "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2",
            "bge-m3": "BAAI/bge-m3",
            "vn-emb-v1": "AITeamVN/Vietnamese_Embedding",
            "vn-emb-v2": "AITeamVN/Vietnamese_Embedding_v2",
        }
        for short, model in embeddings.items():
            col = f"bench_{short.replace('-', '_')}"
            try:
                ensure_collection(model, col)
            except Exception as e:  # model not downloaded etc.
                print(f"skip {short}: {e}")
                continue
            for mode in ("dense", "sparse", "hybrid"):
                if mode == "sparse" and short != "vn-emb-v1":
                    continue  # sparse is embedding-independent
                results.append(run_config(cases, f"{short:10} {mode}", mode=mode, collection=col, embed_model=model))
        best_col, best_model = "bench_vn_emb_v1", embeddings["vn-emb-v1"]
        for rr in ("BAAI/bge-reranker-base", "BAAI/bge-reranker-v2-m3", "AITeamVN/Vietnamese_Reranker"):
            for max_len, cand in ((512, 20), (256, 20), (256, 12)):
                try:
                    results.append(run_config(
                        cases, f"vn-emb-v1  hybrid+rerank {rr.split('/')[-1]} len{max_len} cand{cand}",
                        mode="hybrid_rerank", collection=best_col, embed_model=best_model, reranker_model=rr,
                        reranker_max_length=max_len, rerank_candidates=cand))
                except Exception as e:
                    print(f"skip {rr}: {e}")

    REPORT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text(json.dumps({"generated_at": datetime.now(timezone.utc).isoformat(), "n_cases": len(cases),
                                  "results": results}, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"\nreport → {REPORT}")


if __name__ == "__main__":
    main()
