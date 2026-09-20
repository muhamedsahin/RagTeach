from __future__ import annotations

import asyncio
import io
import tempfile
from pathlib import Path
from typing import Any

from app.core.config import settings
from app.providers.base import STTProvider


class FasterWhisperSTT(STTProvider):
    def __init__(self) -> None:
        self._model = None
        self._loaded_name: str | None = None

    def _load(self, model: str) -> None:
        if self._model is not None and self._loaded_name == model:
            return
        from faster_whisper import WhisperModel

        device = settings.whisper_device
        compute = "float16" if device == "cuda" else "int8"
        try:
            self._model = WhisperModel(model, device=device, compute_type=compute)
        except Exception:
            self._model = WhisperModel(model, device="cpu", compute_type="int8")
        self._loaded_name = model

    async def transcribe(
        self,
        audio_bytes: bytes,
        model: str,
        language: str = "tr",
        **kwargs: Any,
    ) -> str:
        def _run() -> str:
            self._load(model)
            assert self._model is not None
            with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
                tmp.write(audio_bytes)
                path = tmp.name
            try:
                segments, _info = self._model.transcribe(
                    path,
                    language=language,
                    beam_size=1,
                    vad_filter=True,
                )
                return " ".join(seg.text.strip() for seg in segments).strip()
            finally:
                Path(path).unlink(missing_ok=True)

        return await asyncio.to_thread(_run)

    async def unload(self) -> None:
        self._model = None
        self._loaded_name = None
        try:
            import torch

            if torch.cuda.is_available():
                torch.cuda.empty_cache()
        except Exception:
            pass


class OpenAISTT(STTProvider):
    def __init__(self, api_key: str) -> None:
        self.api_key = api_key

    async def transcribe(
        self,
        audio_bytes: bytes,
        model: str,
        language: str = "tr",
        **kwargs: Any,
    ) -> str:
        from openai import AsyncOpenAI

        client = AsyncOpenAI(api_key=self.api_key)
        bio = io.BytesIO(audio_bytes)
        bio.name = "audio.wav"
        result = await client.audio.transcriptions.create(
            model=model or "whisper-1",
            file=bio,
            language=language,
        )
        return result.text


class DeepgramSTT(STTProvider):
    def __init__(self, api_key: str) -> None:
        self.api_key = api_key

    async def transcribe(
        self,
        audio_bytes: bytes,
        model: str,
        language: str = "tr",
        **kwargs: Any,
    ) -> str:
        import httpx

        params = {"model": model or "nova-2", "language": language}
        headers = {
            "Authorization": f"Token {self.api_key}",
            "Content-Type": "audio/wav",
        }
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(
                "https://api.deepgram.com/v1/listen",
                params=params,
                headers=headers,
                content=audio_bytes,
            )
            resp.raise_for_status()
            data = resp.json()
            return (
                data.get("results", {})
                .get("channels", [{}])[0]
                .get("alternatives", [{}])[0]
                .get("transcript", "")
            )
