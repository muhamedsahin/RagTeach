from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


ProviderMode = Literal["offline", "online"]
InteractionMode = Literal["text", "voice", "hybrid"]
SessionState = Literal[
    "idle",
    "indexing",
    "thinking",
    "speaking",
    "listening",
    "paused",
    "stopped",
]
IntentType = Literal["question", "pause", "stop", "continue", "repeat", "unknown"]


class ChannelConfig(BaseModel):
    mode: ProviderMode = "offline"
    provider: str = "ollama"
    model: str = "qwen2.5:14b-instruct-q4_K_M"
    voice: str | None = None
    api_key_ref: str | None = None
    fallback_to_offline: bool = True


class PersonaConfig(BaseModel):
    role: str = "üniversite öğretmeni"
    style: str = "detaylı, sabırlı, soru sorunca lafını bölmeye izin ver"
    language: str = "tr"


class RagConfig(BaseModel):
    top_k: int = 6
    course_id: str | None = None
    chunk_size: int = 800
    chunk_overlap: int = 120


class AppSettings(BaseModel):
    llm: ChannelConfig = Field(
        default_factory=lambda: ChannelConfig(
            mode="offline",
            provider="ollama",
            model="qwen2.5:14b-instruct-q4_K_M",
        )
    )
    stt: ChannelConfig = Field(
        default_factory=lambda: ChannelConfig(
            mode="offline",
            provider="faster-whisper",
            model="medium",
        )
    )
    tts: ChannelConfig = Field(
        default_factory=lambda: ChannelConfig(
            mode="offline",
            provider="kokoro",
            model="kokoro",
            voice="af_heart",
        )
    )
    embedding: ChannelConfig = Field(
        default_factory=lambda: ChannelConfig(
            mode="offline",
            provider="ollama",
            model="nomic-embed-text",
        )
    )
    persona: PersonaConfig = Field(default_factory=PersonaConfig)
    rag: RagConfig = Field(default_factory=RagConfig)
    interaction_mode: InteractionMode = "hybrid"
    unload_local_llm_when_online: bool = True


class WsClientEvent(BaseModel):
    type: str
    payload: dict[str, Any] = Field(default_factory=dict)


class WsServerEvent(BaseModel):
    type: str
    payload: dict[str, Any] = Field(default_factory=dict)


class CourseMeta(BaseModel):
    id: str
    title: str
    filename: str
    page_count: int
    chunk_count: int
    topics: list[str] = Field(default_factory=list)
    embedding_space: str | None = None
    pdf_available: bool = True


class ChunkHit(BaseModel):
    text: str
    page: int
    course_id: str
    score: float = 0.0
    chapter_title: str = ""
    section: str = ""
    chunk_type: str = "theory"  # theory | example | exercise | formula | definition | summary
