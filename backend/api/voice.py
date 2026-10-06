"""
/ws/voice — full-duplex voice counselling over one WebSocket.

client → server : binary PCM16 mono 16 kHz frames · {"type":"start","session_id"} · {"type":"end_utterance"}
                  (push-to-talk / whisper mode) · {"type":"text","query"} · {"type":"stop"}
server → client : stt_partial / stt_final · agent / tool / token / done (same events as chat) ·
                  {"type":"tts_start","sample_rate":24000} · binary PCM16 frames · tts_end · interrupt

Answer audio is synthesised sentence-by-sentence *while the LLM is still streaming*; a new user turn
(barge-in) cancels the in-flight answer.
"""

from __future__ import annotations

import asyncio
import contextlib
import json
import re
import uuid

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from api.routes import stream_with_hub
from api.schemas import safe_session
from api.security import WSSlot, allow, client_ip, ws_origin_ok
from config.settings import get_settings
from services.audio_service import SAMPLE_RATE_OUT, assemblyai_url, stt_record, synth_chunk, transcribe_pcm16
from services.tts_text import speech_chunks
from utils.logger import get_logger

logger = get_logger(__name__)
voice_router = APIRouter()
SENTENCE_END = re.compile(r"[.!?;:\n]")
CLAUSE_END = re.compile(r",")
CLAUSE_MIN = 70


class VoiceSession:
    def __init__(self, ws: WebSocket) -> None:
        self.ws = ws
        self.session_id = uuid.uuid4().hex  # replaced by the client id on "start"
        self.answer_task: asyncio.Task | None = None
        self.send_lock = asyncio.Lock()
        self.pcm_buffer = bytearray()

    async def send_json(self, data: dict) -> None:
        async with self.send_lock:
            await self.ws.send_json(data)

    async def send_bytes(self, data: bytes) -> None:
        async with self.send_lock:
            await self.ws.send_bytes(data)

    async def interrupt(self) -> None:
        if self.answer_task and not self.answer_task.done():
            self.answer_task.cancel()
            with contextlib.suppress(asyncio.CancelledError, Exception):
                await self.answer_task
            await self.send_json({"type": "interrupt"})

    async def answer(self, text: str) -> None:
        """Run the agent graph (channel=voice) and speak sentences as soon as they are complete."""
        await self.send_json({"type": "tts_start", "sample_rate": SAMPLE_RATE_OUT})
        tts_queue: asyncio.Queue[str | None] = asyncio.Queue()

        async def speaker() -> None:
            while (sentence := await tts_queue.get()) is not None:
                pcm = await synth_chunk(sentence)
                if pcm:
                    await self.send_bytes(pcm)

        speaker_task = asyncio.create_task(speaker())
        buf = ""
        try:
            async for ev in stream_with_hub(text, self.session_id, "voice"):
                await self.send_json(ev)
                if ev["type"] == "token":
                    buf += ev["content"]
                    ends = list(SENTENCE_END.finditer(buf))
                    if not ends and len(buf) > CLAUSE_MIN:  # long sentence → speak the first clause now
                        ends = [m for m in CLAUSE_END.finditer(buf) if m.end() > CLAUSE_MIN // 2]
                    if ends:  # speak every completed sentence / clause immediately
                        cut = ends[-1].end()
                        for chunk in speech_chunks(buf[:cut]):
                            await tts_queue.put(chunk)
                        buf = buf[cut:]
                elif ev["type"] == "replace":  # verifier rewrote the answer: speak the corrected version
                    buf = ev["answer"]
            for chunk in speech_chunks(buf):
                await tts_queue.put(chunk)
            await tts_queue.put(None)
            await speaker_task
            await self.send_json({"type": "tts_end"})
        except asyncio.CancelledError:
            speaker_task.cancel()
            raise

    def start_answer(self, text: str) -> None:
        if not allow(client_ip(self.ws)):  # same per-IP quotas as chat
            self.answer_task = asyncio.create_task(self.send_json({"type": "error", "message": "Bạn hỏi hơi nhanh, đợi một chút nhé."}))
            return
        self.answer_task = asyncio.create_task(self.answer(text))


async def _assemblyai_bridge(vs: VoiceSession, audio_q: asyncio.Queue) -> None:
    import ssl

    import certifi
    import websockets

    key = get_settings().assemblyai.api_key
    stt_record("session")
    tls = ssl.create_default_context(cafile=certifi.where())  # python.org builds on macOS ship no system CA store
    async with websockets.connect(assemblyai_url(), additional_headers={"Authorization": key}, max_size=None,
                                  ssl=tls) as aai:
        async def pump() -> None:
            while (frame := await audio_q.get()) is not None:
                await aai.send(frame)
            await aai.send(json.dumps({"type": "Terminate"}))

        pump_task = asyncio.create_task(pump())
        try:
            async for raw in aai:
                msg = json.loads(raw)
                if msg.get("type") == "SpeechStarted":
                    await vs.interrupt()  # barge-in
                elif msg.get("type") == "Turn":
                    text = (msg.get("transcript") or "").strip()
                    if not msg.get("end_of_turn"):
                        if text:
                            await vs.send_json({"type": "stt_partial", "text": text})
                        continue
                    if text:
                        stt_record("turn")
                        await vs.interrupt()
                        await vs.send_json({"type": "stt_final", "text": text})
                        vs.start_answer(text)
                elif msg.get("type") == "Termination":
                    break
        finally:
            pump_task.cancel()


@voice_router.websocket("/ws/voice")
async def ws_voice(ws: WebSocket) -> None:
    if not ws_origin_ok(ws):
        await ws.close(code=1008)
        return
    with WSSlot(client_ip(ws)) as ok:
        if not ok:
            await ws.close(code=1013)
            return
        await ws.accept()
        try:
            await asyncio.wait_for(_voice_loop(ws), timeout=get_settings().security.voice_max_session_s)
        except asyncio.TimeoutError:
            with contextlib.suppress(Exception):
                await ws.send_json({"type": "error", "message": "Phiên giọng nói đã đạt thời lượng tối đa."})
                await ws.close()


async def _voice_loop(ws: WebSocket) -> None:
    vs = VoiceSession(ws)
    use_aai = get_settings().assemblyai.enabled
    audio_q: asyncio.Queue = asyncio.Queue()
    bridge: asyncio.Task | None = None
    await vs.send_json({"type": "ready", "stt": "assemblyai" if use_aai else "whisper"})
    try:
        while True:
            msg = await ws.receive()
            if msg.get("type") == "websocket.disconnect":
                break
            if msg.get("bytes") is not None:
                if use_aai:
                    if bridge is None or bridge.done():
                        if bridge is not None and bridge.exception():
                            stt_record("error", str(bridge.exception()))
                            await vs.send_json({"type": "error", "message": f"STT: {bridge.exception()}"})
                        audio_q = asyncio.Queue()
                        bridge = asyncio.create_task(_assemblyai_bridge(vs, audio_q))
                    await audio_q.put(msg["bytes"])
                else:
                    vs.pcm_buffer += msg["bytes"]
                continue
            data = json.loads(msg.get("text") or "{}")
            kind = data.get("type")
            if kind == "start":
                vs.session_id = safe_session(data.get("session_id"), vs.session_id)
            elif kind == "end_utterance" and not use_aai:
                pcm, vs.pcm_buffer = bytes(vs.pcm_buffer), bytearray()
                if len(pcm) < 16000 * 2 * 0.3:  # < 0.3 s of audio
                    continue
                text = await asyncio.to_thread(transcribe_pcm16, pcm)
                await vs.send_json({"type": "stt_final", "text": text})
                if text:
                    await vs.interrupt()
                    vs.start_answer(text)
            elif kind == "text" and data.get("query"):
                await vs.interrupt()
                vs.start_answer(data["query"])
            elif kind == "interrupt":
                await vs.interrupt()
            elif kind == "stop":
                break
    except WebSocketDisconnect:
        pass
    except Exception as e:  # noqa: BLE001
        logger.warning("ws_voice_error", error=str(e))
    finally:
        await audio_q.put(None)
        await vs.interrupt()
        if bridge:
            bridge.cancel()
