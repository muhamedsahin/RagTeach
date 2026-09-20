"""Simple energy-based VAD helper for server-side use if needed."""

from __future__ import annotations

import struct


def pcm16_rms(frame: bytes) -> float:
    if len(frame) < 2:
        return 0.0
    n = len(frame) // 2
    total = 0
    for i in range(n):
        sample = struct.unpack_from("<h", frame, i * 2)[0]
        total += sample * sample
    return (total / max(n, 1)) ** 0.5


def is_speech(frame: bytes, threshold: float = 500.0) -> bool:
    return pcm16_rms(frame) > threshold
