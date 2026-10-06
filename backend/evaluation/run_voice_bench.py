"""
Voice end-to-end benchmark against the running API (/ws/voice).

Spoken questions are synthesised with a *different* engine (edge-tts, Microsoft neural voice) so the STT is not
listening to our own Kokoro voice, decoded to 16 kHz PCM16 and streamed in real time (50 ms frames) followed by
silence. Measured per utterance:
  stt_final_ms      end of speech → final transcript (AssemblyAI turn detection, or Whisper after release)
  first_audio_ms    end of speech → first byte of the spoken answer
  cer               transcript vs the source sentence (character error rate, punctuation-free)
"""

from __future__ import annotations

import argparse
import asyncio
import io
import json
import re
import statistics
import time
import unicodedata
from pathlib import Path

import websockets

OUT = Path(__file__).parent / "reports" / "voice_bench.json"
QUESTIONS = [
    ("Điểm chuẩn ngành khoa học máy tính năm hai nghìn không trăm hai mươi sáu là bao nhiêu", ["85,45", "85.45", "tám mươi lăm"]),
    ("Học phí chương trình tiêu chuẩn một năm khoảng bao nhiêu tiền", ["31", "ba mươi mốt", "30", "ba mươi"]),
    ("Trường bách khoa có ký túc xá cho tân sinh viên không", ["Hòa Hảo", "Hoà Hảo", "ký túc xá"]),
]


async def synth_pcm16k(text: str) -> bytes:
    import av
    import edge_tts

    mp3 = bytearray()
    async for c in edge_tts.Communicate(text, "vi-VN-NamMinhNeural").stream():
        if c["type"] == "audio":
            mp3 += c["data"]
    container = av.open(io.BytesIO(bytes(mp3)))
    rs = av.audio.resampler.AudioResampler(format="s16", layout="mono", rate=16000)
    pcm = bytearray()
    for frame in container.decode(audio=0):
        for f in rs.resample(frame):
            pcm += f.to_ndarray().tobytes()
    return bytes(pcm)


def norm(s: str) -> str:
    s = unicodedata.normalize("NFC", s.lower())
    return " ".join(re.sub(r"[^\w\s]", " ", s).split())


def cer(ref: str, hyp: str) -> float:
    r, h = norm(ref), norm(hyp)
    d = list(range(len(h) + 1))
    for i in range(1, len(r) + 1):
        prev, d[0] = d[0], i
        for j in range(1, len(h) + 1):
            cur = d[j]
            d[j] = min(d[j] + 1, d[j - 1] + 1, prev + (r[i - 1] != h[j - 1]))
            prev = cur
    return round(d[len(h)] / max(len(r), 1), 4)


async def one(api: str, text: str, expect: list[str]) -> dict:
    pcm = await synth_pcm16k(text)
    async with websockets.connect(f"{api}/ws/voice", max_size=None) as ws:
        ready = json.loads(await ws.recv())
        streaming = ready.get("stt") == "assemblyai"
        await ws.send(json.dumps({"type": "start", "session_id": f"vbench-{time.time_ns()}"}))
        frame = 1600 * 2  # 50 ms @ 16 kHz
        for i in range(0, len(pcm), frame):
            await ws.send(pcm[i:i + frame])
            await asyncio.sleep(0.05)
        speech_end = time.perf_counter()
        if not streaming:
            await ws.send(json.dumps({"type": "end_utterance"}))
        else:
            async def silence():
                try:
                    for _ in range(60):  # 3 s of silence lets semantic turn detection fire
                        await ws.send(b"\x00" * frame)
                        await asyncio.sleep(0.05)
                except websockets.ConnectionClosed:
                    pass
            asyncio.create_task(silence())
        transcript = answer = ""
        stt_ms = first_audio_ms = None
        partials = 0
        while True:
            msg = await asyncio.wait_for(ws.recv(), timeout=90)
            if isinstance(msg, bytes):
                if first_audio_ms is None:
                    first_audio_ms = (time.perf_counter() - speech_end) * 1000
                continue
            ev = json.loads(msg)
            if ev["type"] == "stt_partial":
                partials += 1
            elif ev["type"] == "stt_final":
                transcript, stt_ms = ev["text"], (time.perf_counter() - speech_end) * 1000
            elif ev["type"] == "done":
                answer = ev.get("answer", "")
            elif ev["type"] == "error":
                return {"text": text, "error": ev.get("message")}
            elif ev["type"] == "tts_end":
                break
    return {"text": text, "stt": "assemblyai" if streaming else "whisper", "transcript": transcript,
            "cer": cer(text, transcript), "partials": partials, "stt_final_ms": round(stt_ms or 0, 1),
            "first_audio_ms": round(first_audio_ms or 0, 1), "answer": answer,
            "answer_ok": any(e.lower() in answer.lower() for e in expect), "audio_seconds": round(len(pcm) / 32000, 2)}


async def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--api", default="ws://127.0.0.1:8000")
    args = ap.parse_args()
    rows = []
    for text, expect in QUESTIONS:
        r = await one(args.api, text, expect)
        rows.append(r)
        print(json.dumps({k: r.get(k) for k in ("stt", "cer", "stt_final_ms", "first_audio_ms", "answer_ok", "transcript", "error")},
                         ensure_ascii=False))
        await asyncio.sleep(3)
    ok = [r for r in rows if "error" not in r]
    summary = {"n": len(rows), "stt": ok[0]["stt"] if ok else None,
               "cer_mean": round(statistics.mean(r["cer"] for r in ok), 4) if ok else None,
               "stt_final_ms_p50": statistics.median(r["stt_final_ms"] for r in ok) if ok else None,
               "first_audio_ms_p50": statistics.median(r["first_audio_ms"] for r in ok) if ok else None,
               "answer_ok": f"{sum(r['answer_ok'] for r in ok)}/{len(rows)}"}
    OUT.write_text(json.dumps({"summary": summary, "rows": rows}, ensure_ascii=False, indent=1), encoding="utf-8")
    print(json.dumps(summary, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    asyncio.run(main())
