"""
Vietnamese TTS benchmark: time-to-first-audio-byte (TTFB), total time, real-time factor, samples.

Candidates: edge-tts (cloud, streaming MP3) · Kokoro-Vietnamese (local, sentence-streamed) ·
Gemini TTS (cloud, streaming PCM). Samples → evaluation/reports/tts_samples/.
"""

from __future__ import annotations

import asyncio
import io
import json
import statistics
import time
import wave
from pathlib import Path

HERE = Path(__file__).parent
OUT = HERE / "reports"
SAMPLES = OUT / "tts_samples"
TEXTS = [
    "Chào bạn, mình là BKAi, trợ lý tư vấn tuyển sinh của Trường Đại học Bách khoa.",
    "Năm 2026, ngành Khoa học Máy tính chương trình tiêu chuẩn có điểm chuẩn là tám mươi lăm phẩy bốn lăm điểm.",
    "Bạn nên chuẩn bị chứng chỉ IELTS từ sáu phẩy không trở lên nếu muốn học chương trình dạy bằng tiếng Anh nhé.",
]


async def bench_edge(voice: str) -> dict:
    import edge_tts

    ttfb, total, audio_bytes = [], [], 0
    for i, text in enumerate(TEXTS):
        t0 = time.perf_counter()
        first = None
        buf = bytearray()
        async for chunk in edge_tts.Communicate(text, voice).stream():
            if chunk["type"] == "audio":
                if first is None:
                    first = time.perf_counter() - t0
                buf += chunk["data"]
        ttfb.append(first)
        total.append(time.perf_counter() - t0)
        audio_bytes += len(buf)
        (SAMPLES / f"edge_{voice}_{i}.mp3").write_bytes(bytes(buf))
    return {"engine": f"edge-tts {voice}", "ttfb_ms_p50": round(statistics.median(ttfb) * 1000),
            "total_ms_p50": round(statistics.median(total) * 1000), "streaming": True, "local": False}


def bench_kokoro(voice: str, device: str) -> dict:
    import soundfile as sf
    from kokoro_vietnamese import KokoroVietnamese

    t = time.perf_counter()
    tts = KokoroVietnamese(device=device, voice=voice)
    load_s = time.perf_counter() - t
    tts.synthesize("khởi động")
    lat, rtf = [], []
    for i, text in enumerate(TEXTS):
        t0 = time.perf_counter()
        audio, _ = tts.synthesize(text)
        dt = time.perf_counter() - t0
        dur = len(audio) / 24000
        lat.append(dt)
        rtf.append(dt / dur)
        sf.write(SAMPLES / f"kokoro_{voice}_{i}.wav", audio, 24000)
    return {"engine": f"kokoro-vietnamese {voice} ({device})", "ttfb_ms_p50": round(statistics.median(lat) * 1000),
            "total_ms_p50": round(statistics.median(lat) * 1000), "rtf_p50": round(statistics.median(rtf), 3),
            "load_s": round(load_s, 1), "streaming": "per-sentence", "local": True}


async def bench_gemini(model: str, voice: str) -> dict:
    from google import genai
    from google.genai import types

    from config.settings import get_settings

    client = genai.Client(api_key=get_settings().google.api_key)
    cfg = types.GenerateContentConfig(response_modalities=["AUDIO"], speech_config=types.SpeechConfig(
        voice_config=types.VoiceConfig(prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name=voice))))
    ttfb, total = [], []
    for i, text in enumerate(TEXTS[:2]):  # free-tier TTS quota is small
        t0 = time.perf_counter()
        first = None
        pcm = bytearray()
        async for chunk in await client.aio.models.generate_content_stream(model=model, contents=text, config=cfg):
            for part in (chunk.candidates[0].content.parts if chunk.candidates and chunk.candidates[0].content else []):
                if part.inline_data and part.inline_data.data:
                    if first is None:
                        first = time.perf_counter() - t0
                    pcm += part.inline_data.data
        ttfb.append(first or 0)
        total.append(time.perf_counter() - t0)
        b = io.BytesIO()
        with wave.open(b, "wb") as w:
            w.setnchannels(1)
            w.setsampwidth(2)
            w.setframerate(24000)
            w.writeframes(bytes(pcm))
        (SAMPLES / f"gemini_{voice}_{i}.wav").write_bytes(b.getvalue())
    return {"engine": f"{model} {voice}", "ttfb_ms_p50": round(statistics.median(ttfb) * 1000),
            "total_ms_p50": round(statistics.median(total) * 1000), "streaming": True, "local": False}


async def main() -> None:
    SAMPLES.mkdir(parents=True, exist_ok=True)
    results = []
    for voice in ("vi-VN-HoaiMyNeural", "vi-VN-NamMinhNeural"):
        try:
            results.append(await bench_edge(voice))
        except Exception as e:  # noqa: BLE001
            results.append({"engine": f"edge-tts {voice}", "error": str(e)[:200]})
    for device in ("cpu", "mps"):
        try:
            results.append(await asyncio.to_thread(bench_kokoro, "mai_linh", device))
        except Exception as e:  # noqa: BLE001
            results.append({"engine": f"kokoro-vietnamese ({device})", "error": str(e)[:300]})
    try:
        results.append(await bench_gemini("gemini-3.8-flash-lite-tts", "Kore"))
    except Exception as e:  # noqa: BLE001
        results.append({"engine": "gemini-3.8-flash-lite-tts", "error": str(e)[:300]})
    for r in results:
        print(json.dumps(r, ensure_ascii=False))
    (OUT / "tts_bench.json").write_text(json.dumps(results, ensure_ascii=False, indent=1), encoding="utf-8")


if __name__ == "__main__":
    asyncio.run(main())


def intelligibility(model_size: str = "large-v3-turbo") -> list[dict]:
    """ASR round-trip: Whisper transcribes each sample; character error rate vs the source text."""
    import re
    import unicodedata

    from faster_whisper import WhisperModel

    def norm(s: str) -> str:
        s = unicodedata.normalize("NFC", s.lower())
        return re.sub(r"[^\w\s]", "", s).split().__str__()

    def cer(ref: str, hyp: str) -> float:
        r, h = " ".join(eval(norm(ref))), " ".join(eval(norm(hyp)))
        d = list(range(len(h) + 1))
        for i in range(1, len(r) + 1):
            prev, d[0] = d[0], i
            for j in range(1, len(h) + 1):
                cur = d[j]
                d[j] = min(d[j] + 1, d[j - 1] + 1, prev + (r[i - 1] != h[j - 1]))
                prev = cur
        return d[len(h)] / max(len(r), 1)

    asr = WhisperModel(model_size, device="cpu", compute_type="int8")
    rows = []
    for f in sorted(SAMPLES.glob("*")):
        engine, idx = f.stem.rsplit("_", 1)
        segs, _ = asr.transcribe(str(f), language="vi", beam_size=5)
        hyp = " ".join(s.text for s in segs)
        rows.append({"engine": engine, "sample": int(idx), "cer": round(cer(TEXTS[int(idx)], hyp), 4), "asr": hyp.strip()})
    summary = {}
    for r in rows:
        summary.setdefault(r["engine"], []).append(r["cer"])
    out = [{"engine": k, "cer_mean": round(sum(v) / len(v), 4), "n": len(v)} for k, v in summary.items()]
    (OUT / "tts_intelligibility.json").write_text(json.dumps({"summary": out, "rows": rows}, ensure_ascii=False, indent=1),
                                                 encoding="utf-8")
    return out
