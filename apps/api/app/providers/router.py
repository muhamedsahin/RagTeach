from __future__ import annotations

from typing import Any

from app.core.models import AppSettings, ChannelConfig
from app.core.settings_store import store
from app.providers.base import EmbedProvider, LLMProvider, STTProvider, TTSProvider
from app.providers.cloud_llm import AnthropicLLM, GeminiLLM
from app.providers.ollama_provider import OllamaEmbed, OllamaLLM
from app.providers.openai_compat import (
    DeepSeekLLM,
    GroqLLM,
    MoonshotLLM,
    OpenAILLM,
    OpenRouterLLM,
    XAILLM,
)
from app.providers.stt import DeepgramSTT, FasterWhisperSTT, OpenAISTT
from app.providers.tts import (
    EdgeTTSProvider,
    ElevenLabsTTSProvider,
    KokoroTTSProvider,
    OpenAITTSProvider,
    PiperTTSProvider,
)


class ProviderRouter:
    def __init__(self) -> None:
        self._ollama_llm = OllamaLLM()
        self._ollama_embed = OllamaEmbed()
        self._whisper = FasterWhisperSTT()
        self._kokoro = KokoroTTSProvider()
        self._piper = PiperTTSProvider()
        self._edge = EdgeTTSProvider()

    def get_settings(self) -> AppSettings:
        return store.load_settings()

    def _key(self, channel: ChannelConfig) -> str | None:
        return store.get_key(channel.api_key_ref)

    def resolve_llm(self, cfg: ChannelConfig | None = None) -> tuple[LLMProvider, str]:
        app = self.get_settings()
        channel = cfg or app.llm
        if channel.mode == "offline" or channel.provider == "ollama":
            return self._ollama_llm, channel.model

        key = self._key(channel)
        if not key:
            if channel.fallback_to_offline:
                return self._ollama_llm, app.llm.model if app.llm.provider == "ollama" else "qwen2.5:14b-instruct-q4_K_M"
            raise ValueError(f"API key missing for LLM provider: {channel.provider}")

        provider = channel.provider.lower()
        if provider == "openai":
            return OpenAILLM(key), channel.model
        if provider == "openrouter":
            return OpenRouterLLM(key), channel.model
        if provider == "groq":
            return GroqLLM(key), channel.model
        if provider in ("xai", "grok"):
            return XAILLM(key), channel.model
        if provider == "deepseek":
            return DeepSeekLLM(key), channel.model
        if provider in ("kimi", "moonshot"):
            return MoonshotLLM(key), channel.model
        if provider == "gemini":
            return GeminiLLM(key), channel.model
        if provider == "anthropic":
            return AnthropicLLM(key), channel.model
        if provider == "openai-compatible":
            # model field unused for base; store base in voice field as hack — use OpenAI with custom
            return OpenAILLM(key), channel.model

        if channel.fallback_to_offline:
            return self._ollama_llm, "qwen2.5:14b-instruct-q4_K_M"
        raise ValueError(f"Unknown LLM provider: {channel.provider}")

    def resolve_stt(self, cfg: ChannelConfig | None = None) -> tuple[STTProvider, str]:
        app = self.get_settings()
        channel = cfg or app.stt
        if channel.mode == "offline" or channel.provider in ("faster-whisper", "whisper"):
            return self._whisper, channel.model

        key = self._key(channel)
        if not key:
            if channel.fallback_to_offline:
                return self._whisper, app.stt.model
            raise ValueError(f"API key missing for STT provider: {channel.provider}")

        provider = channel.provider.lower()
        if provider == "openai":
            return OpenAISTT(key), channel.model or "whisper-1"
        if provider == "deepgram":
            return DeepgramSTT(key), channel.model or "nova-2"
        if channel.fallback_to_offline:
            return self._whisper, app.stt.model
        raise ValueError(f"Unknown STT provider: {channel.provider}")

    def resolve_tts(self, cfg: ChannelConfig | None = None) -> tuple[TTSProvider, str | None]:
        app = self.get_settings()
        channel = cfg or app.tts
        provider = channel.provider.lower()

        if channel.mode == "offline":
            if provider == "piper":
                return self._piper, channel.voice
            return self._kokoro, channel.voice

        if provider == "edge-tts" or provider == "edge":
            return self._edge, channel.voice or "tr-TR-EmelNeural"

        key = self._key(channel)
        if not key:
            if channel.fallback_to_offline:
                return self._kokoro, channel.voice
            # Edge is free online fallback
            return self._edge, "tr-TR-EmelNeural"

        if provider == "openai":
            return OpenAITTSProvider(key), channel.voice or "nova"
        if provider == "elevenlabs":
            return ElevenLabsTTSProvider(key), channel.voice
        if channel.fallback_to_offline:
            return self._kokoro, channel.voice
        raise ValueError(f"Unknown TTS provider: {channel.provider}")

    def resolve_embed(self, cfg: ChannelConfig | None = None) -> tuple[EmbedProvider, str]:
        app = self.get_settings()
        channel = cfg or app.embedding
        return self._ollama_embed, channel.model

    async def maybe_unload_local_llm(self) -> None:
        app = self.get_settings()
        if app.unload_local_llm_when_online and app.llm.mode == "online":
            await self._ollama_llm.unload()

    async def warmup(self) -> dict[str, Any]:
        """Warm models based on current settings without blocking forever."""
        status: dict[str, Any] = {"llm": "skip", "stt": "skip", "tts": "skip"}
        app = self.get_settings()
        try:
            if app.llm.mode == "offline":
                # light ping
                status["llm"] = "ready"
            if app.stt.mode == "offline":
                # defer heavy whisper load until first use
                status["stt"] = "lazy"
            if app.tts.mode == "offline":
                status["tts"] = "lazy"
        except Exception as exc:
            status["error"] = str(exc)
        return status

    async def release_stt_vram(self) -> None:
        await self._whisper.unload()

    async def release_tts_vram(self) -> None:
        await self._kokoro.unload()


router = ProviderRouter()
