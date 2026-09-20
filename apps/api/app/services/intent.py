from __future__ import annotations

import re

from app.core.models import IntentType


PAUSE_PATTERNS = [
    r"\bdur\b",
    r"\bbekle\b",
    r"\bpause\b",
    r"\bduraklat\b",
    r"bir saniye",
    r"bekletebilir",
]
STOP_PATTERNS = [
    r"\bbitir\b",
    r"\bstop\b",
    r"\bsonlandır\b",
    r"yeter",
    r"kapat",
    r"dersi bitir",
]
CONTINUE_PATTERNS = [
    r"\bdevam\b",
    r"\bcontinue\b",
    r"sürdür",
    r"anlatmaya devam",
]
REPEAT_PATTERNS = [
    r"\btekrar\b",
    r"\brepeat\b",
    r"bir daha anlat",
    r"tekrar eder misin",
]


def classify_intent(text: str) -> IntentType:
    t = (text or "").strip().lower()
    if not t:
        return "unknown"
    for pat in STOP_PATTERNS:
        if re.search(pat, t, re.I):
            return "stop"
    for pat in PAUSE_PATTERNS:
        if re.search(pat, t, re.I):
            return "pause"
    for pat in CONTINUE_PATTERNS:
        if re.search(pat, t, re.I):
            return "continue"
    for pat in REPEAT_PATTERNS:
        if re.search(pat, t, re.I):
            return "repeat"
    # question-like
    if "?" in t or t.startswith(("ne ", "neden", "nasıl", "hangi", "kim", "kaç", "anlat")):
        return "question"
    if len(t.split()) >= 3:
        return "question"
    return "unknown"
