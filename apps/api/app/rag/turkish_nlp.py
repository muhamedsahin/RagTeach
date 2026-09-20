"""
Turkish Natural Language Processing module for RagTeach RAG Engine.

Handles:
- Correct Turkish casing (İ↔i, I↔ı)
- Snowball Turkish stemmer integration
- 180+ Turkish stopword filtering
- BM25-ready tokenization pipeline
"""

from __future__ import annotations

import re
from functools import lru_cache

# ── Turkish Stopwords (180+) ─────────────────────────────────────────────────
TURKISH_STOPWORDS: frozenset[str] = frozenset({
    "acaba", "altmış", "altı", "ama", "anca", "ancak", "arada", "aslında",
    "ayrıca", "bana", "bazı", "belki", "ben", "benden", "beni", "benim",
    "beş", "bile", "bin", "bir", "biri", "birçok", "birkaç", "birşey",
    "birşeyi", "biz", "bizden", "bize", "bizi", "bizim", "böyle", "böylece",
    "bu", "buna", "bunda", "bundan", "bunlar", "bunları", "bunların", "bunu",
    "bunun", "burada", "çok", "çünkü", "da", "daha", "dahi", "de", "defa",
    "değil", "diğer", "diye", "doksan", "dokuz", "dolayı", "dolayısıyla",
    "dört", "edecek", "eden", "ederek", "edilecek", "ediliyor", "edilmesi",
    "ediyor", "eğer", "elli", "en", "etmesi", "etti", "ettiği", "ettiğini",
    "fakat", "filan", "gene", "gibi", "göre", "hâlâ", "halen", "hangi",
    "hatta", "hem", "henüz", "hep", "hepsi", "her", "herhangi", "herkes",
    "herkesin", "hiç", "hiçbir", "için", "iki", "ile", "ilgili", "ise",
    "işte", "itibaren", "itibariyle", "kaç", "kadar", "karşı", "karşın",
    "kendi", "kendilerine", "kendine", "kendini", "kendisi", "kendisine",
    "kendisini", "kez", "ki", "kim", "kimden", "kime", "kimi", "kimse",
    "kırk", "madem", "milyar", "milyon", "mu", "mü", "mı", "mısın",
    "nasıl", "ne", "neden", "nedenle", "nerde", "nerede", "nereye",
    "nitekim", "niye", "olan", "olarak", "oldu", "olduğu", "olduğunu",
    "olmadı", "olmadığı", "olmak", "olması", "olmayan", "olmaz", "olsa",
    "olsun", "olup", "olur", "olursa", "oluyor", "on", "ona", "ondan",
    "onlar", "onlardan", "onlara", "onları", "onların", "onu", "onun",
    "orada", "otuz", "öbür", "ön", "önce", "ötürü", "öyle", "pek",
    "rağmen", "sadece", "sanki", "sekiz", "seksen", "sen", "senden",
    "seni", "senin", "siz", "sizden", "size", "sizi", "sizin", "sonra",
    "şayet", "şey", "şeyden", "şeyi", "şeyler", "şimdi", "şöyle", "şu",
    "şuna", "şunda", "şundan", "şunları", "şunu", "tarafından", "trilyon",
    "tüm", "tümü", "üç", "üzere", "var", "vardı", "ve", "veya", "ya",
    "yani", "yapacak", "yapılan", "yapılması", "yapıyor", "yapmak", "yaptı",
    "yaptığı", "yaptığını", "yaptıkları", "yedi", "yerine", "yetmiş",
    "yine", "yirmi", "yok", "yoksa", "zaten", "zira",
})


def turkish_lower(text: str) -> str:
    """
    Turkish-aware lowercase conversion.
    Standard Python lower() maps I→i which is WRONG in Turkish.
    Turkish rules: İ→i, I→ı, all else normal.
    """
    return text.replace("İ", "i").replace("I", "ı").lower()


def turkish_upper(text: str) -> str:
    """
    Turkish-aware uppercase conversion.
    Turkish rules: i→İ, ı→I, all else normal.
    """
    return text.replace("i", "İ").replace("ı", "I").upper()


# ── Snowball Turkish Stemmer ──────────────────────────────────────────────────

_stemmer = None


def _get_stemmer():
    """Lazy-load the Snowball Turkish stemmer."""
    global _stemmer
    if _stemmer is None:
        try:
            from snowballstemmer import stemmer as sb_stemmer
            _stemmer = sb_stemmer("turkish")
        except ImportError:
            # Fallback: no stemming if snowballstemmer not installed
            class _NoOp:
                def stemWord(self, w: str) -> str:
                    return w
            _stemmer = _NoOp()
    return _stemmer


def stem_turkish(word: str) -> str:
    """Stem a single Turkish word using Snowball stemmer."""
    return _get_stemmer().stemWord(word)


# ── Tokenization Pipeline ────────────────────────────────────────────────────

# Regex for Turkish word tokens (includes ç, ğ, ı, ö, ş, ü and accented chars)
_WORD_PATTERN = re.compile(r"\b[\wçğıöşüÇĞİÖŞÜâêîôû]+\b", re.UNICODE)


def tokenize_turkish(text: str) -> list[str]:
    """
    Extract word tokens from text using Turkish-aware lowercasing.
    Returns lowercase tokens preserving Turkish characters.
    """
    lowered = turkish_lower(text)
    return _WORD_PATTERN.findall(lowered)


def preprocess_for_bm25(text: str) -> list[str]:
    """
    Full Turkish BM25 preprocessing pipeline:
    1. Turkish-aware lowercasing (İ→i, I→ı)
    2. Tokenization
    3. Stopword removal
    4. Snowball stemming
    5. Length filtering (len > 1)

    Returns list of stemmed tokens ready for BM25 indexing.
    """
    tokens = tokenize_turkish(text)
    stemmer = _get_stemmer()

    processed = []
    for token in tokens:
        if token in TURKISH_STOPWORDS:
            continue
        if len(token) <= 1:
            continue
        stemmed = stemmer.stemWord(token)
        if stemmed and len(stemmed) > 1:
            processed.append(stemmed)

    return processed


def normalize_text(text: str) -> str:
    """
    Normalize text for consistent processing:
    - Normalize whitespace
    - Normalize line endings
    - Strip leading/trailing whitespace
    """
    text = re.sub(r"\r\n", "\n", text)
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()

