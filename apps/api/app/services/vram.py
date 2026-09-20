"""RTX 3070 (8GB) friendly load/unload helpers."""

from __future__ import annotations

from typing import Any

from app.providers.router import router


async def warmup_pipeline() -> dict[str, Any]:
    status = await router.warmup()
    status["strategy"] = {
        "keep": "ollama_llm",
        "ephemeral": ["faster-whisper", "kokoro"],
        "note": "STT/TTS after each utterance release CUDA cache",
    }
    return status


async def release_ephemeral_vram() -> dict[str, Any]:
    await router.release_stt_vram()
    await router.release_tts_vram()
    return {"ok": True}
