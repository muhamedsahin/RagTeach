from __future__ import annotations

import asyncio
from collections.abc import AsyncIterator
from typing import Any

from app.providers.base import LLMProvider


class GeminiLLM(LLMProvider):
    def __init__(self, api_key: str) -> None:
        self.api_key = api_key

    async def stream_chat(
        self,
        messages: list[dict[str, str]],
        model: str,
        **kwargs: Any,
    ) -> AsyncIterator[str]:
        import google.generativeai as genai

        genai.configure(api_key=self.api_key)
        system = ""
        contents: list[dict[str, Any]] = []
        for msg in messages:
            role = msg["role"]
            if role == "system":
                system += msg["content"] + "\n"
                continue
            gem_role = "user" if role == "user" else "model"
            contents.append({"role": gem_role, "parts": [msg["content"]]})

        model_name = model if model.startswith("models/") else model
        gm = genai.GenerativeModel(model_name, system_instruction=system or None)

        queue: asyncio.Queue[str | None] = asyncio.Queue()
        loop = asyncio.get_running_loop()

        def _produce() -> None:
            try:
                response = gm.generate_content(contents, stream=True)
                for chunk in response:
                    text = getattr(chunk, "text", None)
                    if text:
                        loop.call_soon_threadsafe(queue.put_nowait, text)
            except Exception as exc:
                loop.call_soon_threadsafe(queue.put_nowait, f"[gemini error: {exc}]")
            finally:
                loop.call_soon_threadsafe(queue.put_nowait, None)

        loop.run_in_executor(None, _produce)
        while True:
            item = await queue.get()
            if item is None:
                break
            yield item


class AnthropicLLM(LLMProvider):
    def __init__(self, api_key: str) -> None:
        self.api_key = api_key

    async def stream_chat(
        self,
        messages: list[dict[str, str]],
        model: str,
        **kwargs: Any,
    ) -> AsyncIterator[str]:
        import anthropic

        client = anthropic.AsyncAnthropic(api_key=self.api_key)
        system = ""
        converted: list[dict[str, Any]] = []
        for msg in messages:
            if msg["role"] == "system":
                system += msg["content"] + "\n"
            else:
                converted.append(
                    {"role": msg["role"], "content": msg["content"]}
                )

        async with client.messages.stream(
            model=model,
            max_tokens=4096,
            system=system or anthropic.NOT_GIVEN,
            messages=converted,
        ) as stream:
            async for text in stream.text_stream:
                yield text
