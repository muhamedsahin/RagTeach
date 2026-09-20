"""
Advanced Semantic Chunking Engine for RagTeach RAG.

Implements:
- Parent-Child chunking: small child chunks for retrieval, large parent chunks for LLM context
- Sentence-window chunking: single sentences with surrounding context window
- Hierarchical metadata enrichment (book, chapter, section, page, chunk_type)
- PyMuPDF TOC extraction for real chapter/section headings
- Smart chunk type detection (theory, example, exercise, formula, definition, summary)
"""

from __future__ import annotations

import re
import uuid
from dataclasses import dataclass, field
from typing import Any

import fitz  # PyMuPDF

from app.rag.turkish_nlp import normalize_text


# ── Data Models ──────────────────────────────────────────────────────────────

@dataclass
class ChunkMetadata:
    """Rich metadata for each chunk."""
    book_title: str = ""
    chapter_number: int = 0
    chapter_title: str = ""
    section: str = ""
    page_number: int = 1
    chunk_type: str = "theory"  # theory | example | exercise | formula | definition | summary
    parent_id: str | None = None  # For child chunks, references the parent chunk


@dataclass
class DocumentChunk:
    """A single chunk from a document with full metadata."""
    id: str = ""
    course_id: str = ""
    text: str = ""
    metadata: ChunkMetadata = field(default_factory=ChunkMetadata)

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "course_id": self.course_id,
            "text": self.text,
            "page": self.metadata.page_number,
            "chapter_number": self.metadata.chapter_number,
            "chapter_title": self.metadata.chapter_title,
            "section": self.metadata.section,
            "chunk_type": self.metadata.chunk_type,
            "parent_id": self.metadata.parent_id or "",
        }


# ── Chunk Type Detection ─────────────────────────────────────────────────────

_EXAMPLE_PATTERNS = re.compile(
    r"(?:^|\n)\s*(?:Örnek|Example|Çözüm|Solution|ÖRNEK|EXAMPLE)\s*[\d.:)\-]",
    re.IGNORECASE | re.MULTILINE,
)
_EXERCISE_PATTERNS = re.compile(
    r"(?:^|\n)\s*(?:Soru|Alıştırma|Exercise|Problem|Ödev|Question|SORU|PROBLEM)\s*[\d.:)\-]",
    re.IGNORECASE | re.MULTILINE,
)
_FORMULA_PATTERNS = re.compile(
    r"(?:\$\$.+?\$\$|\\begin\{equation\}|\\begin\{align\}|[A-Za-z]\s*=\s*[A-Za-z0-9\s\+\-\*/\^()]+(?:\n|$))",
    re.DOTALL,
)
_DEFINITION_PATTERNS = re.compile(
    r"(?:^|\n)\s*(?:Tanım|Definition|Teorem|Theorem|Aksiyom|Axiom|Lemma|TANIM|TEOREM)\s*[\d.:)\-]",
    re.IGNORECASE | re.MULTILINE,
)
_SUMMARY_PATTERNS = re.compile(
    r"(?:^|\n)\s*(?:Özet|Summary|Sonuç|Conclusion|ÖZET|SONUÇ)\s*[\d.:)\-]?",
    re.IGNORECASE | re.MULTILINE,
)


def detect_chunk_type(text: str) -> str:
    """Detect the type of content in a chunk."""
    if _EXAMPLE_PATTERNS.search(text):
        return "example"
    if _EXERCISE_PATTERNS.search(text):
        return "exercise"
    if _DEFINITION_PATTERNS.search(text):
        return "definition"
    if _SUMMARY_PATTERNS.search(text):
        return "summary"
    # Check for formula density (more than 2 formula-like patterns)
    formulas = _FORMULA_PATTERNS.findall(text)
    if len(formulas) >= 2:
        return "formula"
    return "theory"


# ── TOC Extraction ───────────────────────────────────────────────────────────

@dataclass
class TOCEntry:
    level: int
    title: str
    page: int


def extract_toc_from_pdf(doc: fitz.Document) -> list[TOCEntry]:
    """
    Extract Table of Contents from PDF using PyMuPDF's get_toc().
    Falls back to regex-based header detection if TOC is empty.
    """
    toc_raw = doc.get_toc()
    entries: list[TOCEntry] = []

    if toc_raw:
        for level, title, page in toc_raw:
            cleaned = title.strip()
            if cleaned and len(cleaned) > 2:
                entries.append(TOCEntry(level=level, title=cleaned, page=max(1, page)))

    return entries


def extract_toc_from_text(pages: list[str]) -> list[TOCEntry]:
    """
    Fallback: Extract chapter/section headings from page text using regex patterns.
    Used when PDF has no embedded TOC bookmarks.
    """
    entries: list[TOCEntry] = []
    chapter_pattern = re.compile(
        r"^(?:Chapter|Bölüm|BÖLÜM|CHAPTER|Ünite|ÜNİTE)\s+(\d+)[:\.\s]+(.{4,80})",
        re.MULTILINE | re.IGNORECASE,
    )
    section_pattern = re.compile(
        r"^(\d+\.\d+(?:\.\d+)?)\s+([A-ZÇĞİÖŞÜa-zçğıöşü].{4,80})",
        re.MULTILINE,
    )

    for page_idx, page_text in enumerate(pages[:80]):
        for match in chapter_pattern.finditer(page_text):
            entries.append(TOCEntry(
                level=1,
                title=f"Bölüm {match.group(1)}: {match.group(2).strip()}",
                page=page_idx + 1,
            ))
        for match in section_pattern.finditer(page_text):
            entries.append(TOCEntry(
                level=2,
                title=f"{match.group(1)} {match.group(2).strip()}",
                page=page_idx + 1,
            ))

    return entries


# ── Sentence Splitter ────────────────────────────────────────────────────────

_SENTENCE_BOUNDARY = re.compile(
    r'(?<=[.!?…])\s+(?=[A-ZÇĞİÖŞÜa-zçğıöşü0-9""\'\(])'
)


def split_sentences(text: str) -> list[str]:
    """Split text into sentences using punctuation boundaries."""
    sentences = _SENTENCE_BOUNDARY.split(text)
    return [s.strip() for s in sentences if s.strip() and len(s.strip()) > 5]


# ── Main Chunking Engine ─────────────────────────────────────────────────────

class SemanticChunker:
    """
    Production-grade semantic chunking engine.

    Implements parent-child chunking:
    - Child chunks (256 chars): Small, precise units for embedding & retrieval
    - Parent chunks (1024 chars): Larger context windows sent to the LLM

    When a child chunk matches a query, the retriever returns the parent chunk
    to give the LLM sufficient context for accurate answers.
    """

    def __init__(
        self,
        child_chunk_size: int = 300,
        parent_chunk_size: int = 1200,
        child_overlap: int = 50,
        parent_overlap: int = 100,
    ):
        self.child_chunk_size = child_chunk_size
        self.parent_chunk_size = parent_chunk_size
        self.child_overlap = child_overlap
        self.parent_overlap = parent_overlap

    def chunk_document(
        self,
        doc: fitz.Document,
        course_id: str,
        book_title: str,
    ) -> tuple[list[DocumentChunk], list[DocumentChunk], list[str]]:
        """
        Process a PDF document into parent and child chunks.

        Returns:
            (parent_chunks, child_chunks, page_texts)
            - parent_chunks: Large context chunks (for LLM)
            - child_chunks: Small retrieval chunks (for embedding/search)
            - page_texts: Raw text per page
        """
        # 1. Extract page texts
        page_texts: list[str] = []
        for page in doc:
            text = page.get_text("text") or ""
            page_texts.append(normalize_text(text))

        # 2. Get TOC structure
        toc_entries = extract_toc_from_pdf(doc)
        if not toc_entries:
            toc_entries = extract_toc_from_text(page_texts)

        # 3. Build chapter map: page_number -> (chapter_number, chapter_title, section)
        chapter_map = self._build_chapter_map(toc_entries, len(page_texts))

        # 4. Create parent chunks
        parent_chunks = self._create_parent_chunks(
            page_texts, course_id, book_title, chapter_map
        )

        # 5. Create child chunks from parent chunks
        child_chunks = self._create_child_chunks(parent_chunks, course_id, book_title)

        return parent_chunks, child_chunks, page_texts

    def _build_chapter_map(
        self, toc_entries: list[TOCEntry], total_pages: int
    ) -> dict[int, tuple[int, str, str]]:
        """
        Build a mapping from page number to (chapter_number, chapter_title, section_title).
        """
        chapter_map: dict[int, tuple[int, str, str]] = {}

        current_chapter_num = 0
        current_chapter_title = "Giriş"
        current_section = "Genel"

        # Sort entries by page
        sorted_entries = sorted(toc_entries, key=lambda e: e.page)

        entry_idx = 0
        for page_num in range(1, total_pages + 1):
            # Check if we've reached a new TOC entry
            while entry_idx < len(sorted_entries) and sorted_entries[entry_idx].page <= page_num:
                entry = sorted_entries[entry_idx]
                if entry.level == 1:
                    current_chapter_num += 1
                    current_chapter_title = entry.title
                    current_section = entry.title
                elif entry.level >= 2:
                    current_section = entry.title
                entry_idx += 1

            chapter_map[page_num] = (current_chapter_num, current_chapter_title, current_section)

        return chapter_map

    def _create_parent_chunks(
        self,
        page_texts: list[str],
        course_id: str,
        book_title: str,
        chapter_map: dict[int, tuple[int, str, str]],
    ) -> list[DocumentChunk]:
        """Create large parent chunks for LLM context."""
        parent_chunks: list[DocumentChunk] = []
        buffer = ""
        current_page = 1

        for page_idx, page_text in enumerate(page_texts):
            page_num = page_idx + 1

            if not page_text.strip():
                continue

            paragraphs = [p.strip() for p in page_text.split("\n\n") if p.strip() and len(p.strip()) > 15]

            for para in paragraphs:
                if len(buffer) + len(para) + 2 <= self.parent_chunk_size:
                    buffer = f"{buffer}\n\n{para}".strip() if buffer else para
                else:
                    if buffer:
                        ch_num, ch_title, section = chapter_map.get(
                            current_page, (0, "Genel", "Genel")
                        )
                        parent_id = uuid.uuid4().hex[:12]
                        parent_chunks.append(DocumentChunk(
                            id=parent_id,
                            course_id=course_id,
                            text=buffer,
                            metadata=ChunkMetadata(
                                book_title=book_title,
                                chapter_number=ch_num,
                                chapter_title=ch_title,
                                section=section,
                                page_number=current_page,
                                chunk_type=detect_chunk_type(buffer),
                            ),
                        ))

                    # Overlap: keep last N chars
                    overlap_text = buffer[-self.parent_overlap:] if len(buffer) > self.parent_overlap else ""
                    buffer = f"{overlap_text}\n\n{para}".strip() if overlap_text else para
                    current_page = page_num

            current_page = page_num

        # Flush remaining buffer
        if buffer:
            ch_num, ch_title, section = chapter_map.get(current_page, (0, "Genel", "Genel"))
            parent_chunks.append(DocumentChunk(
                id=uuid.uuid4().hex[:12],
                course_id=course_id,
                text=buffer,
                metadata=ChunkMetadata(
                    book_title=book_title,
                    chapter_number=ch_num,
                    chapter_title=ch_title,
                    section=section,
                    page_number=current_page,
                    chunk_type=detect_chunk_type(buffer),
                ),
            ))

        return parent_chunks

    def _create_child_chunks(
        self,
        parent_chunks: list[DocumentChunk],
        course_id: str,
        book_title: str,
    ) -> list[DocumentChunk]:
        """
        Create small child chunks from parent chunks for precise retrieval.
        Each child references its parent via parent_id.
        """
        child_chunks: list[DocumentChunk] = []

        for parent in parent_chunks:
            sentences = split_sentences(parent.text)
            if not sentences:
                # If no sentence boundaries found, treat entire parent as a child
                child_chunks.append(DocumentChunk(
                    id=uuid.uuid4().hex[:12],
                    course_id=course_id,
                    text=parent.text,
                    metadata=ChunkMetadata(
                        book_title=book_title,
                        chapter_number=parent.metadata.chapter_number,
                        chapter_title=parent.metadata.chapter_title,
                        section=parent.metadata.section,
                        page_number=parent.metadata.page_number,
                        chunk_type=parent.metadata.chunk_type,
                        parent_id=parent.id,
                    ),
                ))
                continue

            # Pack sentences into child chunks
            buffer = ""
            for sentence in sentences:
                if len(buffer) + len(sentence) + 1 <= self.child_chunk_size:
                    buffer = f"{buffer} {sentence}".strip() if buffer else sentence
                else:
                    if buffer:
                        child_chunks.append(DocumentChunk(
                            id=uuid.uuid4().hex[:12],
                            course_id=course_id,
                            text=buffer,
                            metadata=ChunkMetadata(
                                book_title=book_title,
                                chapter_number=parent.metadata.chapter_number,
                                chapter_title=parent.metadata.chapter_title,
                                section=parent.metadata.section,
                                page_number=parent.metadata.page_number,
                                chunk_type=parent.metadata.chunk_type,
                                parent_id=parent.id,
                            ),
                        ))
                    buffer = sentence

            if buffer:
                child_chunks.append(DocumentChunk(
                    id=uuid.uuid4().hex[:12],
                    course_id=course_id,
                    text=buffer,
                    metadata=ChunkMetadata(
                        book_title=book_title,
                        chapter_number=parent.metadata.chapter_number,
                        chapter_title=parent.metadata.chapter_title,
                        section=parent.metadata.section,
                        page_number=parent.metadata.page_number,
                        chunk_type=parent.metadata.chunk_type,
                        parent_id=parent.id,
                    ),
                ))

        return child_chunks


def extract_topics_from_toc(
    doc: fitz.Document,
    page_texts: list[str],
    limit: int = 24,
) -> list[str]:
    """
    Extract structured syllabus topics from PDF.
    Uses PyMuPDF TOC first, falls back to text regex.
    """
    toc_entries = extract_toc_from_pdf(doc)
    if not toc_entries:
        toc_entries = extract_toc_from_text(page_texts)

    topics: list[str] = []
    for entry in toc_entries[:limit]:
        prefix = f"{entry.level}." if entry.level <= 2 else "  •"
        topic = f"{prefix} {entry.title}"
        if topic not in topics:
            topics.append(topic)

    if not topics:
        # Absolute fallback
        topics = [
            "1. Giriş ve Temel Kavramlar",
            "2. Kuramsal Çerçeve",
            "3. Yöntem ve Analiz",
            "4. Sonuçlar ve Tartışma",
            "5. İleri Konular",
        ]

    return topics

