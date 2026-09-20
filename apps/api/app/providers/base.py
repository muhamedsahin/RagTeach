from __future__ import annotations

from abc import ABC, abstractmethod
from collections.abc import AsyncIterator
from typing import Any


class LLMProvider(ABC):
    @abstractmethod
    async def stream_chat(
        self,
        messages: list[dict[str, str]],
        model: str,
        **kwargs: Any,
    ) -> AsyncIterator[str]:
        ...

    async def unload(self) -> None:
        return None


class STTProvider(ABC):
    @abstractmethod
    async def transcribe(
        self,
        audio_bytes: bytes,
        model: str,
        language: str = "tr",
        **kwargs: Any,
    ) -> str:
        ...

    async def unload(self) -> None:
        return None


class TTSProvider(ABC):
    @abstractmethod
    async def synthesize(
        self,
        text: str,
        voice: str | None = None,
        model: str | None = None,
        **kwargs: Any,
    ) -> AsyncIterator[bytes]:
        """Yield PCM/WAV/MP3 audio chunks."""
        ...

    async def unload(self) -> None:
        return None


class EmbedProvider(ABC):
    @abstractmethod
    async def embed(self, texts: list[str], model: str) -> list[list[float]]:
        ...
