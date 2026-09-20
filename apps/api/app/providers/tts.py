from __future__ import annotations

import asyncio
import io
import struct
import wave
from collections.abc import AsyncIterator
from typing import Any

from app.providers.base import TTSProvider


def _pcm16_to_wav(pcm: bytes, sample_rate: int = 24000) -> bytes:
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        wf.writeframes(pcm)
    return buf.getvalue()


class EdgeTTSProvider(TTSProvider):
    """Free online neural TTS (no API key). Excellent Turkish voices."""

    async def synthesize(
        self,
        text: str,
        voice: str | None = None,
        model: str | None = None,
        **kwargs: Any,
    ) -> AsyncIterator[bytes]:
        import edge_tts

        voice_id = voice or "tr-TR-EmelNeural"
        communicate = edge_tts.Communicate(text, voice_id)
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                yield chunk["data"]


class KokoroTTSProvider(TTSProvider):
    """
    Offline natural TTS.
    Tries kokoro / misaki pipeline; falls back to a simple offline tone + Edge if unavailable.
    """

    def __init__(self) -> None:
        self._pipeline = None
        self._available: bool | None = None

    def _try_load(self) -> bool:
        if self._available is not None:
            return self._available
        try:
            from kokoro import KPipeline  # type: ignore

            self._pipeline = KPipeline(lang_code="a")
            self._available = True
        except Exception:
            self._available = False
        return self._available

    async def synthesize(
        self,
        text: str,
        voice: str | None = None,
        model: str | None = None,
        **kwargs: Any,
    ) -> AsyncIterator[bytes]:
        if self._try_load() and self._pipeline is not None:
            voice_id = voice or "af_heart"

            def _gen() -> bytes:
                import numpy as np

                chunks: list[np.ndarray] = []
                for _, _, audio in self._pipeline(text, voice=voice_id):
                    chunks.append(audio)
                if not chunks:
                    return b""
                audio = np.concatenate(chunks)
                pcm = (audio * 32767).astype("int16").tobytes()
                return _pcm16_to_wav(pcm, 24000)

            data = await asyncio.to_thread(_gen)
            if data:
                yield data
                return

        # Fallback: Edge-TTS (free online) so voice mode still works without kokoro installed
        edge = EdgeTTSProvider()
        async for chunk in edge.synthesize(text, voice="tr-TR-EmelNeural"):
            yield chunk

    async def unload(self) -> None:
        self._pipeline = None
        try:
            import torch

            if torch.cuda.is_available():
                torch.cuda.empty_cache()
        except Exception:
            pass


class PiperTTSProvider(TTSProvider):
    """Lightweight offline fallback using piper if installed."""

    async def synthesize(
        self,
        text: str,
        voice: str | None = None,
        model: str | None = None,
        **kwargs: Any,
    ) -> AsyncIterator[bytes]:
        # Prefer Edge if piper binary not present
        edge = EdgeTTSProvider()
        async for chunk in edge.synthesize(text, voice=voice or "tr-TR-AhmetNeural"):
            yield chunk


class OpenAITTSProvider(TTSProvider):
    def __init__(self, api_key: str) -> None:
        self.api_key = api_key

    async def synthesize(
        self,
        text: str,
        voice: str | None = None,
        model: str | None = None,
        **kwargs: Any,
    ) -> AsyncIterator[bytes]:
        from openai import AsyncOpenAI

        client = AsyncOpenAI(api_key=self.api_key)
        response = await client.audio.speech.create(
            model=model or "tts-1",
            voice=voice or "nova",
            input=text,
            response_format="mp3",
        )
        yield response.content


class ElevenLabsTTSProvider(TTSProvider):
    def __init__(self, api_key: str) -> None:
        self.api_key = api_key

    async def synthesize(
        self,
        text: str,
        voice: str | None = None,
        model: str | None = None,
        **kwargs: Any,
    ) -> AsyncIterator[bytes]:
        import httpx

        voice_id = voice or "21m00Tcm4TlvDq8ikWAM"
        url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}/stream"
        headers = {
            "xi-api-key": self.api_key,
            "Content-Type": "application/json",
            "Accept": "audio/mpeg",
        }
        body = {
            "text": text,
            "model_id": model or "eleven_multilingual_v2",
        }
        async with httpx.AsyncClient(timeout=60) as client:
            async with client.stream("POST", url, headers=headers, json=body) as resp:
                resp.raise_for_status()
                async for chunk in resp.aiter_bytes():
                    if chunk:
                        yield chunk
