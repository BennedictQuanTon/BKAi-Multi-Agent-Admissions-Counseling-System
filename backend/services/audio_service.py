"""
Voice I/O.

TTS  — Kokoro-Vietnamese (local ONNX/torch, Apache-2.0) by default: chosen by evaluation/run_tts_bench.py
       (~0.6 s per sentence on CPU vs edge-tts ~3.8 s TTFB). Falls back to edge-tts, then Gemini TTS.
       Output: 24 kHz mono PCM16, synthesised sentence-by-sentence so playback starts after the first chunk.
STT  — AssemblyAI Universal-3.6 Pro streaming (Vietnamese, semantic turn detection, keyterm boosting) when
       ASSEMBLYAI_API_KEY is set; otherwise local faster-whisper on push-to-talk utterances.
"""

from __future__ import annotations

import asyncio
import io
import json
import threading
import time
import wave
from collections.abc import AsyncIterator
from functools import lru_cache
from urllib.parse import urlencode

import numpy as np

from config.settings import get_settings
from services.tts_text import speech_chunks
from utils.logger import get_logger

logger = get_logger(__name__)
SAMPLE_RATE_OUT = 24000
_tts_lock = threading.Lock()


# ──────────────────────────────────────────────
# TTS engines → PCM16 bytes @ 24 kHz
# ──────────────────────────────────────────────
@lru_cache(maxsize=1)
def _kokoro():
    from kokoro_vietnamese import KokoroVietnamese

    return KokoroVietnamese(device="cpu", voice=get_settings().voice.kokoro_voice)


def _float_to_pcm16(audio) -> bytes:
    a = np.clip(np.asarray(audio, dtype=np.float32), -1.0, 1.0)
    return (a * 32767).astype("<i2").tobytes()


def _kokoro_pcm(text: str) -> bytes:
    with _tts_lock:
        audio, _ = _kokoro().synthesize(text)
    return _float_to_pcm16(audio)


async def _edge_pcm(text: str) -> bytes:
    import av
    import edge_tts

    mp3 = bytearray()
    async for chunk in edge_tts.Communicate(text, get_settings().voice.edge_voice).stream():
        if chunk["type"] == "audio":
            mp3 += chunk["data"]
    container = av.open(io.BytesIO(bytes(mp3)))
    resampler = av.audio.resampler.AudioResampler(format="s16", layout="mono", rate=SAMPLE_RATE_OUT)
    pcm = bytearray()
    for frame in container.decode(audio=0):
        for f in resampler.resample(frame):
            pcm += f.to_ndarray().tobytes()
    return bytes(pcm)


async def _gemini_pcm(text: str) -> bytes:
    from google import genai
    from google.genai import types

    s = get_settings()
    client = genai.Client(api_key=s.google.api_key)
    cfg = types.GenerateContentConfig(response_modalities=["AUDIO"], speech_config=types.SpeechConfig(
        voice_config=types.VoiceConfig(prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name=s.voice.gemini_tts_voice))))
    pcm = bytearray()
    async for chunk in await client.aio.models.generate_content_stream(model=s.voice.gemini_tts_model, contents=text,
                                                                      config=cfg):
        for part in (chunk.candidates[0].content.parts if chunk.candidates and chunk.candidates[0].content else []):
            if part.inline_data and part.inline_data.data:
                pcm += part.inline_data.data
    return bytes(pcm)


async def synth_chunk(text: str) -> bytes:
    order = {"kokoro": ["kokoro", "edge", "gemini"], "edge": ["edge", "kokoro", "gemini"],
             "gemini": ["gemini", "kokoro", "edge"]}.get(get_settings().voice.tts_provider, ["kokoro", "edge"])
    for engine in order:
        try:
            if engine == "kokoro":
                return await asyncio.to_thread(_kokoro_pcm, text)
            if engine == "edge":
                return await _edge_pcm(text)
            return await _gemini_pcm(text)
        except Exception as e:  # noqa: BLE001
            logger.warning("tts_engine_failed", engine=engine, error=str(e)[:160])
    return b""


async def tts_pcm_stream(text: str) -> AsyncIterator[bytes]:
    """Synthesise sentence chunks; the next chunk is prepared while the current one is being sent."""
    chunks = speech_chunks(text)
    if not chunks:
        return
    pending = asyncio.create_task(synth_chunk(chunks[0]))
    for nxt in [*chunks[1:], None]:
        pcm = await pending
        if nxt is not None:
            pending = asyncio.create_task(synth_chunk(nxt))
        if pcm:
            yield pcm


def wav_header(sample_rate: int = SAMPLE_RATE_OUT) -> bytes:
    b = io.BytesIO()
    with wave.open(b, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sample_rate)
        w.writeframes(b"")
    h = bytearray(b.getvalue())
    h[4:8] = (0xFFFFFFFF).to_bytes(4, "little")    # unknown length → streamable WAV
    h[40:44] = (0xFFFFFFFF).to_bytes(4, "little")
    return bytes(h)


async def tts_stream(text: str) -> AsyncIterator[bytes]:
    """Streaming WAV for the REST endpoint."""
    yield wav_header()
    async for pcm in tts_pcm_stream(text):
        yield pcm


def warmup_tts() -> None:
    if get_settings().voice.tts_provider == "kokoro":
        _kokoro_pcm("xin chào")


# ──────────────────────────────────────────────
# STT
# ──────────────────────────────────────────────
_STT = {"sessions": 0, "turns": 0, "errors": 0, "last_turn_at": None, "last_error": None}


def stt_record(kind: str, error: str = "") -> None:
    if kind == "session":
        _STT["sessions"] += 1
    elif kind == "turn":
        _STT["turns"] += 1
        _STT["last_turn_at"] = time.time()
    elif kind == "error":
        _STT["errors"] += 1
        _STT["last_error"] = error[:160]


def stt_stats() -> dict:
    return dict(_STT)


@lru_cache(maxsize=1)
def keyterms() -> list[str]:
    from knowledge.facts import query

    names = [r["name"] for r in query("SELECT DISTINCT name FROM majors") if len(r["name"]) <= 50]
    base = ["Bách khoa", "HCMUT", "ĐGNL", "đánh giá năng lực", "điểm chuẩn", "chỉ tiêu", "xét tuyển tổng hợp",
            "học bạ", "tổ hợp", "ký túc xá", "học phí", "IELTS", "UTS", "PFIEV", "chương trình tiếng Anh"]
    return list(dict.fromkeys(base + names))[:100]


def assemblyai_url() -> str:
    s = get_settings().assemblyai
    params = {"speech_model": s.speech_model, "sample_rate": s.sample_rate, "encoding": "pcm_s16le",
              "language_codes": json.dumps(["vi", "en"]), "keyterms_prompt": json.dumps(keyterms(), ensure_ascii=False),
              "min_turn_silence": 400, "max_turn_silence": 1500}
    return "wss://streaming.assemblyai.com/v3/ws?" + urlencode(params)


@lru_cache(maxsize=1)
def _whisper():
    from faster_whisper import WhisperModel

    return WhisperModel("large-v3-turbo", device="cpu", compute_type="int8")


def transcribe_pcm16(pcm: bytes) -> str:
    """PCM16 mono 16 kHz → text (faster-whisper large-v3-turbo, int8 CPU)."""
    audio = np.frombuffer(pcm, dtype="<i2").astype(np.float32) / 32768.0
    segs, _ = _whisper().transcribe(audio, language="vi", beam_size=1, vad_filter=True,
                                    initial_prompt="Tư vấn tuyển sinh Đại học Bách khoa: điểm chuẩn, chỉ tiêu, ĐGNL, học phí.")
    return " ".join(s.text.strip() for s in segs).strip()
