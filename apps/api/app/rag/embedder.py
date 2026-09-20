"""
Multi-Provider Embedding Service for RagTeach RAG Engine.

Supports:
- Offline: Ollama nomic-embed-text (768-dim)
- Online: OpenAI text-embedding-3-small (1536-dim, truncatable via MRL)
- Online: Google Gemini text-embedding-004 (768-dim)
- Deterministic fallback: hash-based pseudo-embedding for zero-dependency mode
- Batch processing (configurable batch size)
- L2 normalization guarantee
- Consistent vector dimensionality enforcement
"""

from __future__ import annotations

import hashlib
import logging
import math
import re
from typing import Any

import numpy as np

from app.core.config import settings

logger = logging.getLogger(__name__)

# ── Target vector dimension for the project ──────────────────────────────────
# All embeddings are normalized to this dimension for consistent LanceDB schema.
TARGET_DIM = 768


# ── Deterministic Fallback Embedding ─────────────────────────────────────────

def generate_fallback_embedding(text: str, dim: int = TARGET_DIM) -> list[float]:
    """
    Deterministic pseudo-embedding using n-gram subword hashing with L2 normalization.
    Used when no embedding model (Ollama or API) is available.
    Not semantically meaningful but ensures consistent dimensionality and non-zero vectors.
    """
    tokens = re.findall(r"\w+", text.lower())
    vec = np.zeros(dim, dtype=np.float64)

    for i, token in enumerate(tokens):
        # Unigram hash into vector position
        h1 = int(hashlib.sha256(token.encode("utf-8")).hexdigest()[:8], 16) % dim
        vec[h1] += 1.0

        # Bigram hash for local context
        if i > 0:
            bi = f"{tokens[i - 1]}_{token}"
            h2 = int(hashlib.md5(bi.encode("utf-8")).hexdigest()[:8], 16) % dim
            vec[h2] += 1.5

        # Trigram hash for wider context
        if i > 1:
            tri = f"{tokens[i - 2]}_{tokens[i - 1]}_{token}"
            h3 = int(hashlib.sha256(tri.encode("utf-8")).hexdigest()[:8], 16) % dim
            vec[h3] += 0.8

    norm = np.linalg.norm(vec)
    if norm > 0:
        vec = vec / norm
    return vec.tolist()


# ── Embedding Provider Interface ─────────────────────────────────────────────

class EmbeddingProvider:
    """Base class for embedding providers."""

    async def embed_batch(self, texts: list[str]) -> list[list[float]]:
        raise NotImplementedError

    async def embed_single(self, text: str) -> list[float]:
        results = await self.embed_batch([text])
        return results[0]


class OllamaEmbedding(EmbeddingProvider):
    """Embed via local Ollama server (nomic-embed-text, 768-dim)."""

    def __init__(self, model: str = "nomic-embed-text", base_url: str | None = None):
        self.model = model
        self.base_url = base_url or settings.ollama_base_url

    async def embed_batch(self, texts: list[str], batch_size: int = 16) -> list[list[float]]:
        import httpx

        all_vectors: list[list[float]] = []
        url = f"{self.base_url}/api/embed"

        async with httpx.AsyncClient(timeout=120.0) as client:
            for i in range(0, len(texts), batch_size):
                batch = texts[i : i + batch_size]
                try:
                    resp = await client.post(url, json={
                        "model": self.model,
                        "input": batch,
                    })
                    resp.raise_for_status()
                    data = resp.json()

                    # Ollama /api/embed returns {"embeddings": [[...], [...]]}
                    embeddings = data.get("embeddings", [])
                    if embeddings:
                        if len(embeddings) != len(batch):
                            raise ValueError("Embedding count mismatch")
                        all_vectors.extend(embeddings)
                    else:
                        # Fallback to legacy single endpoint
                        for text in batch:
                            resp2 = await client.post(
                                f"{self.base_url}/api/embeddings",
                                json={"model": self.model, "prompt": text},
                            )
                            resp2.raise_for_status()
                            vec = resp2.json().get("embedding", [])
                            all_vectors.append(vec)
                except Exception as e:
                    logger.warning(f"Ollama embedding batch failed: {e}, using fallback")
                    raise RuntimeError("Embedding provider unavailable") from e

        return _normalize_dimensions(all_vectors)


class OpenAIEmbedding(EmbeddingProvider):
    """Embed via OpenAI API (text-embedding-3-small)."""

    def __init__(self, api_key: str, model: str = "text-embedding-3-small"):
        self.api_key = api_key
        self.model = model

    async def embed_batch(self, texts: list[str], batch_size: int = 32) -> list[list[float]]:
        import httpx

        all_vectors: list[list[float]] = []

        async with httpx.AsyncClient(timeout=60.0) as client:
            for i in range(0, len(texts), batch_size):
                batch = texts[i : i + batch_size]
                try:
                    resp = await client.post(
                        "https://api.openai.com/v1/embeddings",
                        headers={
                            "Authorization": f"Bearer {self.api_key}",
                            "Content-Type": "application/json",
                        },
                        json={
                            "input": batch,
                            "model": self.model,
                            "dimensions": TARGET_DIM,  # MRL truncation
                        },
                    )
                    resp.raise_for_status()
                    data = resp.json()
                    embeddings = [item["embedding"] for item in data["data"]]
                    all_vectors.extend(embeddings)
                except Exception as e:
                    logger.warning(f"OpenAI embedding failed: {e}, using fallback")
                    raise RuntimeError("Embedding provider unavailable") from e

        return _normalize_dimensions(all_vectors)


class GeminiEmbedding(EmbeddingProvider):
    """Embed via Google Gemini API (text-embedding-004, 768-dim)."""

    def __init__(self, api_key: str, model: str = "text-embedding-004"):
        self.api_key = api_key
        self.model = model

    async def embed_batch(self, texts: list[str], batch_size: int = 32) -> list[list[float]]:
        import httpx

        all_vectors: list[list[float]] = []
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.model}:batchEmbedContents"

        async with httpx.AsyncClient(timeout=60.0) as client:
            for i in range(0, len(texts), batch_size):
                batch = texts[i : i + batch_size]
                try:
                    requests_body = [
                        {
                            "model": f"models/{self.model}",
                            "content": {"parts": [{"text": t}]},
                            "taskType": "RETRIEVAL_DOCUMENT",
                        }
                        for t in batch
                    ]

                    resp = await client.post(
                        f"{url}?key={self.api_key}",
                        json={"requests": requests_body},
                    )
                    resp.raise_for_status()
                    data = resp.json()
                    embeddings = [
                        emb["values"]
                        for emb in data.get("embeddings", [])
                    ]
                    all_vectors.extend(embeddings)
                except Exception as e:
                    logger.warning(f"Gemini embedding failed: {e}, using fallback")
                    raise RuntimeError("Embedding provider unavailable") from e

        return _normalize_dimensions(all_vectors)


class DeepSeekEmbedding(EmbeddingProvider):
    """Embed via DeepSeek API (OpenAI-compatible)."""

    def __init__(self, api_key: str, model: str = "deepseek-chat"):
        self.api_key = api_key
        self.model = model

    async def embed_batch(self, texts: list[str], batch_size: int = 16) -> list[list[float]]:
        # DeepSeek doesn't have a dedicated embedding endpoint yet
        # Use fallback
        logger.info("DeepSeek embedding not available, using fallback")
        return [generate_fallback_embedding(t) for t in texts]


# ── Dimension Normalization ──────────────────────────────────────────────────

def _normalize_dimensions(vectors: list[list[float]], target_dim: int = TARGET_DIM) -> list[list[float]]:
    """
    Ensure all vectors have consistent dimensions.
    Truncates longer vectors, pads shorter ones with zeros.
    L2-normalizes all vectors.
    """
    normalized: list[list[float]] = []

    for vec in vectors:
        if len(vec) == target_dim:
            arr = np.array(vec, dtype=np.float64)
        elif len(vec) > target_dim:
            # MRL truncation
            arr = np.array(vec[:target_dim], dtype=np.float64)
        else:
            # Pad with zeros
            arr = np.zeros(target_dim, dtype=np.float64)
            arr[: len(vec)] = vec

        # L2 normalize
        norm = np.linalg.norm(arr)
        if norm > 0:
            arr = arr / norm

        normalized.append(arr.tolist())

    if any(not np.all(np.isfinite(v)) or not any(v) for v in normalized):
        raise ValueError("Invalid embedding vector")
    return normalized


# ── Factory ──────────────────────────────────────────────────────────────────

def create_embedding_provider(
    provider: str = "ollama",
    model: str | None = None,
    api_key: str | None = None,
) -> EmbeddingProvider:
    """
    Factory function to create the appropriate embedding provider.

    Args:
        provider: "ollama" | "openai" | "gemini" | "deepseek" | "fallback"
        model: Model name (provider-specific)
        api_key: API key for cloud providers
    """
    provider = provider.lower()

    if provider == "ollama":
        return OllamaEmbedding(model=model or "nomic-embed-text")

    if provider == "openai" and api_key:
        return OpenAIEmbedding(api_key=api_key, model=model or "text-embedding-3-small")

    if provider == "gemini" and api_key:
        return GeminiEmbedding(api_key=api_key, model=model or "text-embedding-004")

    if provider == "deepseek" and api_key:
        return DeepSeekEmbedding(api_key=api_key, model=model or "deepseek-chat")

    # Fallback: hash-based
    logger.info(f"No embedding provider matched for '{provider}', using fallback")

    class FallbackProvider(EmbeddingProvider):
        async def embed_batch(self, texts: list[str]) -> list[list[float]]:
            return [generate_fallback_embedding(t) for t in texts]

    return FallbackProvider()

