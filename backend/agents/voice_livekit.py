"""
BKAi realtime voice worker (LiveKit Agents ≥ 1.8) — optional WebRTC path for telephony / mobile.

  STT  AssemblyAI Universal-3.6 Pro streaming (vi, keyterms from the majors table, semantic turn detection)
       → Deepgram nova-3 if only DEEPGRAM_API_KEY is set.
  LLM  the BKAi multi-agent graph, streamed token-by-token from the backend WebSocket (channel=voice).
  TTS  Kokoro-Vietnamese (local) with edge-tts / Gemini fallback — same engine as the in-app /ws/voice path.

Run (from backend/):  python -m agents.voice_livekit download-files && python -m agents.voice_livekit dev
"""

from __future__ import annotations

import json
import logging
import os
import uuid

from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))
logger = logging.getLogger("bkai-voice")
BACKEND_WS = os.getenv("BKAI_BACKEND_URL", "http://127.0.0.1:8000").replace("http", "ws", 1) + "/ws/chat"


def build_stt():
    from config.settings import get_settings

    s = get_settings()
    if s.assemblyai.enabled:
        from livekit.plugins import assemblyai

        from services.audio_service import keyterms

        logger.info("stt=assemblyai model=%s", s.assemblyai.speech_model)
        return assemblyai.STT(api_key=s.assemblyai.api_key, model=s.assemblyai.speech_model,
                              language_codes=["vi", "en"], keyterms_prompt=keyterms(),
                              min_turn_silence=400, max_turn_silence=1500), "stt"
    from livekit.plugins import deepgram

    logger.info("stt=deepgram (set ASSEMBLYAI_API_KEY to use AssemblyAI)")
    return deepgram.STT(model=os.getenv("DEEPGRAM_STT_MODEL", "nova-3"), language="vi"), "vad"


def main() -> None:
    from livekit.agents import (Agent, AgentSession, APIConnectOptions, AutoSubscribe, JobContext, WorkerOptions, cli,
                                llm, tts)
    from livekit.agents.types import DEFAULT_API_CONNECT_OPTIONS
    from livekit.plugins import silero

    class BackendLLM(llm.LLM):
        """Adapter: LiveKit LLM interface → BKAi multi-agent graph over WebSocket (streaming)."""

        def __init__(self, session_id: str) -> None:
            super().__init__()
            self.session_id = session_id

        def chat(self, *, chat_ctx: llm.ChatContext, tools=None, conn_options=DEFAULT_API_CONNECT_OPTIONS, **_):
            return _BackendStream(self, chat_ctx=chat_ctx, tools=tools or [], conn_options=conn_options)

    class _BackendStream(llm.LLMStream):
        async def _run(self) -> None:
            import websockets

            text = ""
            for item in reversed(self._chat_ctx.items):
                if getattr(item, "role", None) == "user":
                    text = item.text_content or ""
                    break
            rid = uuid.uuid4().hex[:8]
            async with websockets.connect(BACKEND_WS, max_size=None) as ws:
                await ws.send(json.dumps({"query": text[:500] or "Xin chào", "session_id": self._llm.session_id,
                                          "channel": "voice"}))
                async for raw in ws:
                    ev = json.loads(raw)
                    if ev["type"] == "token":
                        self._event_ch.send_nowait(llm.ChatChunk(id=rid, delta=llm.ChoiceDelta(role="assistant",
                                                                                              content=ev["content"])))
                    elif ev["type"] in ("done", "error"):
                        break

    class KokoroTTS(tts.TTS):
        """Non-streaming per call; LiveKit's StreamAdapter feeds it one sentence at a time."""

        def __init__(self) -> None:
            super().__init__(capabilities=tts.TTSCapabilities(streaming=False), sample_rate=24000, num_channels=1)

        def synthesize(self, text: str, *, conn_options: APIConnectOptions = DEFAULT_API_CONNECT_OPTIONS):
            return _KokoroStream(tts=self, input_text=text, conn_options=conn_options)

    class _KokoroStream(tts.ChunkedStream):
        async def _run(self, output_emitter: tts.AudioEmitter) -> None:
            from services.audio_service import synth_chunk
            from services.tts_text import normalize_for_speech

            output_emitter.initialize(request_id=uuid.uuid4().hex, sample_rate=24000, num_channels=1,
                                      mime_type="audio/pcm")
            pcm = await synth_chunk(normalize_for_speech(self._input_text))
            if pcm:
                output_emitter.push(pcm)
            output_emitter.flush()

    async def entrypoint(ctx: JobContext) -> None:
        await ctx.connect(auto_subscribe=AutoSubscribe.AUDIO_ONLY)
        stt, turn_detection = build_stt()
        session = AgentSession(vad=silero.VAD.load(), stt=stt, turn_detection=turn_detection,
                               llm=BackendLLM(session_id=f"lk-{ctx.room.name}"), tts=KokoroTTS(),
                               allow_interruptions=True)
        await session.start(agent=Agent(instructions="BKAi — tư vấn tuyển sinh HCMUT."), room=ctx.room)
        await session.say("Chào bạn, mình là BKAi. Bạn muốn hỏi gì về tuyển sinh Bách khoa?")

    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint))


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    main()
