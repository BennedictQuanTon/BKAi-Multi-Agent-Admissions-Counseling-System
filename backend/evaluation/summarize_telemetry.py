"""
Steady-state latency from real request telemetry (Redis), separating warm-up and provider incidents.

Every answered question is stored by memory/telemetry.py. This script pools one or more Redis prefixes
(one per test session) and labels each LLM-backed request with the first reason that applies:

  gemini_error_failover   a Gemini call failed (429/503/504) and the pool retried on another model
  cold_start              first LLM request of a server process (connection + model warm-up): the first one in a
                          prefix, the first after a > 15 min idle gap (restarts happen between sessions), or --cold ids
  fallback_model_quota    answered by the fallback model because the primary's per-minute quota was used up
  gemini_stall            a Gemini call took > 8 s to its first token without an error

Requests with none of these are "steady state". Both views are reported, so nothing is hidden.

    python -m evaluation.summarize_telemetry --prefixes bkai_test bkai_bench bkai_v5 bkai
"""

from __future__ import annotations

import argparse
import json
import statistics
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

import redis

from config.settings import get_settings

OUT = Path(__file__).parent / "reports" / "telemetry_summary.json"
STALL_MS = 8000
IDLE_GAP_S = 900


def pct(values, p):
    v = sorted(x for x in values if x is not None)
    return round(v[min(len(v) - 1, int(round(p * (len(v) - 1))))], 1) if v else None


def summary(rows: list[dict]) -> dict:
    lat = [e["latency_ms"] for e in rows]
    ttft = [e.get("ttft_ms") for e in rows]
    overhead = [e["latency_ms"] - sum(c.get("ms") or 0 for c in e["llm_calls"]) for e in rows]
    return {"n": len(rows),
            "latency_ms": {p: pct(lat, q) for p, q in (("p50", .5), ("p90", .9), ("p95", .95), ("p99", .99))},
            "ttft_ms": {"p50": pct(ttft, .5), "p95": pct(ttft, .95)},
            "non_llm_overhead_ms": {"p50": pct(overhead, .5), "p95": pct(overhead, .95)}}


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--prefixes", nargs="+", default=["bkai_test", "bkai_bench", "bkai_v5", "bkai"])
    ap.add_argument("--cold", nargs="*", default=[], help="extra question ids known to be the first after a restart")
    args = ap.parse_args()
    s = get_settings()
    r = redis.Redis.from_url(s.redis.url)
    primary = s.gemini.model_primary

    rows: list[dict] = []
    for prefix in args.prefixes:
        items = sorted((json.loads(x) for x in r.lrange(f"{prefix}:questions", 0, -1)), key=lambda e: e.get("ts", 0))
        items = [e for e in items if e.get("latency_ms") is not None and e.get("route")]
        last_llm_ts = None
        for e in items:
            e["_prefix"] = prefix
            has_llm = bool(e.get("llm_calls"))
            gap = last_llm_ts is None or e.get("ts", 0) - last_llm_ts > IDLE_GAP_S
            e["_cold"] = (has_llm and gap) or e.get("id") in args.cold
            if has_llm:
                last_llm_ts = e.get("ts", 0)
            rows.append(e)

    def reason(e: dict) -> str | None:
        calls = e.get("llm_calls") or []
        if any(c.get("error") for c in calls):
            return "gemini_error_failover"
        if e["_cold"]:
            return "cold_start"
        if any(c.get("model") != primary for c in calls):
            return "fallback_model_quota"
        if any((c.get("ttft_ms") or 0) > STALL_MS for c in calls):
            return "gemini_stall"
        return None

    llm = [e for e in rows if e.get("llm_calls") and e["route"] not in ("cache", "guardrail")]
    steady = [e for e in llm if reason(e) is None]
    synth = [c for e in steady for c in e["llm_calls"] if c.get("node") == "synthesizer"]
    cache = [e for e in rows if e["route"] == "cache"]
    per_sec = Counter(int(e.get("ts", 0)) for e in cache)
    report = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "prefixes": args.prefixes,
        "requests_total": len(rows),
        "routes": dict(Counter(e["route"] for e in rows)),
        "llm_requests": len(llm),
        "excluded": dict(Counter(reason(e) for e in llm if reason(e))),
        "all_llm": summary(llm),
        "steady_state": summary(steady),
        "steady_by_route": {rt: summary([e for e in steady if e["route"] == rt]) for rt in ("fast_path", "supervisor")},
        "synthesizer": {"ttft_ms_p50": pct([c.get("ttft_ms") for c in synth], .5),
                        "tpot_ms_p50": pct([c.get("tpot_ms") for c in synth], .5),
                        "tokens_per_s_p50": pct([c.get("tokens_per_s") for c in synth], .5)},
        "llm_calls_per_answer": round(statistics.mean(len(e.get("llm_calls") or []) for e in rows), 2),
        "tokens_per_llm_answer_p50": {"in": pct([sum(c.get("in_tokens") or 0 for c in e["llm_calls"]) for e in steady], .5),
                                      "out": pct([sum(c.get("out_tokens") or 0 for c in e["llm_calls"]) for e in steady], .5)},
        "cache_ms_p50": {"single": pct([e["latency_ms"] for e in cache if per_sec[int(e.get("ts", 0))] < 5], .5),
                         "burst_20_concurrent": pct([e["latency_ms"] for e in cache if per_sec[int(e.get("ts", 0))] >= 5], .5)},
        "verifier_pass": f"{sum((e.get('verification') or {}).get('passed', False) for e in llm)}/{len(llm)}",
    }
    OUT.write_text(json.dumps(report, ensure_ascii=False, indent=1), encoding="utf-8")
    print(json.dumps({k: report[k] for k in ("requests_total", "excluded", "steady_state", "all_llm")}, indent=1))


if __name__ == "__main__":
    main()
