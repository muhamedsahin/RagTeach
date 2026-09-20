from __future__ import annotations

from collections.abc import AsyncIterator
from typing import Any

import httpx
import ollama

from app.core.config import settings
from app.providers.base import EmbedProvider, LLMProvider


class OllamaLLM(LLMProvider):
    def __init__(self, base_url: str | None = None) -> None:
        self.base_url = base_url or settings.ollama_base_url
        self._client = ollama.AsyncClient(host=self.base_url)

    async def stream_chat(
        self,
        messages: list[dict[str, str]],
        model: str,
        **kwargs: Any,
    ) -> AsyncIterator[str]:
        stream = await self._client.chat(
            model=model,
            messages=messages,
            stream=True,
            options=kwargs.get("options"),
        )
        async for chunk in stream:
            if isinstance(chunk, dict):
                content = (chunk.get("message") or {}).get("content") or ""
            else:
                message = getattr(chunk, "message", None)
                content = getattr(message, "content", None) or ""
            if content:
                yield content

    async def unload(self) -> None:
        # Best-effort: ask Ollama to keep model unloaded by setting keep_alive=0
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                await client.post(
                    f"{self.base_url}/api/generate",
                    json={"model": settings.default_llm_model, "keep_alive": 0, "prompt": ""},
                )
        except Exception:
            pass


class OllamaEmbed(EmbedProvider):
    def __init__(self, base_url: str | None = None) -> None:
        self._client = ollama.AsyncClient(host=base_url or settings.ollama_base_url)

    async def embed(self, texts: list[str], model: str) -> list[list[float]]:
        vectors: list[list[float]] = []
        for text in texts:
            res = await self._client.embeddings(model=model, prompt=text)
            vectors.append(res["embedding"])
        return vectors
