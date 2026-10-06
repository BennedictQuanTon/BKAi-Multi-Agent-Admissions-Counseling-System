"""
Policy-RAG agent — hybrid retrieval over official documents with a corrective second hop:
if the best reranked chunk is weak, the query is reformulated (abbreviations expanded, question words
stripped, entity names injected) and searched again; still weak → evidence is flagged low-confidence.
"""

from __future__ import annotations

import asyncio
import re
import time

from agents.state import Evidence, GraphState
from knowledge.facts import Entities, get_major_profiles
from services.events import agent_event
from tools import admissions as T

LOW = 0.15
TOP_K = 5
ABBREV = {"đgnl": "đánh giá năng lực", "thpt": "trung học phổ thông", "ktx": "ký túc xá", "khmt": "khoa học máy tính",
          "ktmt": "kỹ thuật máy tính", "cntt": "công nghệ thông tin", "utxt": "ưu tiên xét tuyển", "hsg": "học sinh giỏi",
          "clc": "chương trình dạy và học bằng tiếng anh", "tne": "liên kết cử nhân kỹ thuật quốc tế UTS",
          "nv": "nguyện vọng", "hb": "học bổng", "sv": "sinh viên"}
QUESTION_WORDS = r"\b(cho (mình|em|tôi) hỏi|là gì|như thế nào|thế nào|bao nhiêu|có được không|không ạ|ạ|vậy|nhé|nha)\b"


def reformulate(query: str, ent: Entities) -> str:
    q = query.lower()
    for k, v in ABBREV.items():
        q = re.sub(rf"\b{k}\b", v, q)
    q = re.sub(QUESTION_WORDS, " ", q)
    names = [p["name"] for p in get_major_profiles(ent.major_ids[:2])] if ent.major_ids else []
    return " ".join([q, *names]).strip()


def run_policy_agent(queries: list[str], ent: Entities) -> tuple[list[Evidence], dict]:
    agent = "policy"
    hops = 1
    hits: dict[str, dict] = {}
    for q in queries[:2]:
        for h in T.search_documents(q, top_k=TOP_K, agent=agent):
            if h["text"] not in hits or h["score"] > hits[h["text"]]["score"]:
                hits[h["text"]] = h
    best = max((h["score"] for h in hits.values()), default=0.0)
    if best < LOW:
        hops = 2
        agent_event(agent, "running", f"Kết quả yếu (top={best:.2f}) → viết lại truy vấn và tìm lần 2")
        for h in T.search_documents(reformulate(queries[0], ent), top_k=TOP_K, agent=agent):
            if h["text"] not in hits or h["score"] > hits[h["text"]]["score"]:
                hits[h["text"]] = h
        best = max((h["score"] for h in hits.values()), default=0.0)

    ranked = sorted(hits.values(), key=lambda h: -h["score"])[:TOP_K]
    keep = [h for h in ranked if h["score"] >= LOW * 0.5] or ranked[:2]
    evidence = [Evidence(agent=agent, kind="doc", title=f"{h['title']} › {h['section']}" if h["section"] else h["title"],
                         content=h["parent_text"] if len(h["parent_text"]) <= 1800 else h["text"],
                         source_url=h["source_url"], score=h["score"]) for h in keep]
    return evidence, {"hops": hops, "best_score": round(best, 3), "low_confidence": best < LOW}


async def policy_agent_node(state: GraphState) -> dict:
    t0 = time.perf_counter()
    agent_event("policy", "running", "Hybrid search (dense + BM25) → rerank tiếng Việt")
    plan = state["plan"]
    ent = Entities(**state["entities"])
    queries = [q for q in [*plan.get("search_queries", []), plan["resolved_query"]] if q]
    queries = list(dict.fromkeys(queries))
    evidence, info = await asyncio.to_thread(run_policy_agent, queries, ent)
    agent_event("policy", "done", f"{len(evidence)} đoạn tài liệu · hops={info['hops']} · top={info['best_score']}", **info)
    return {"evidence": evidence, "timings": {"policy_ms": round((time.perf_counter() - t0) * 1000, 1)}}
