from __future__ import annotations

from collections.abc import AsyncIterator
from typing import Any

import httpx

from app.providers.base import LLMProvider


class OpenAILLM(LLMProvider):
    def __init__(self, api_key: str, base_url: str = "https://api.openai.com/v1") -> None:
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")

    async def stream_chat(
        self,
        messages: list[dict[str, str]],
        model: str,
        **kwargs: Any,
    ) -> AsyncIterator[str]:
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        body = {"model": model, "messages": messages, "stream": True}
        async with httpx.AsyncClient(timeout=120) as client:
            async with client.stream(
                "POST",
                f"{self.base_url}/chat/completions",
                headers=headers,
                json=body,
            ) as resp:
                resp.raise_for_status()
                async for line in resp.aiter_lines():
                    if not line.startswith("data: "):
                        continue
                    data = line[6:].strip()
                    if data == "[DONE]":
                        break
                    import json

                    try:
                        payload = json.loads(data)
                    except json.JSONDecodeError:
                        continue
                    delta = payload.get("choices", [{}])[0].get("delta", {})
                    content = delta.get("content")
                    if content:
                        yield content


class OpenRouterLLM(OpenAILLM):
    def __init__(self, api_key: str) -> None:
        super().__init__(api_key, base_url="https://openrouter.ai/api/v1")


class GroqLLM(OpenAILLM):
    def __init__(self, api_key: str) -> None:
        super().__init__(api_key, base_url="https://api.groq.com/openai/v1")


class XAILLM(OpenAILLM):
    def __init__(self, api_key: str) -> None:
        super().__init__(api_key, base_url="https://api.x.ai/v1")


class DeepSeekLLM(OpenAILLM):
    def __init__(self, api_key: str) -> None:
        super().__init__(api_key, base_url="https://api.deepseek.com")


class MoonshotLLM(OpenAILLM):
    def __init__(self, api_key: str) -> None:
        super().__init__(api_key, base_url="https://api.moonshot.cn/v1")

