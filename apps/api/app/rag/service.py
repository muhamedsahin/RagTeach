"""
Production-Grade RAG Service for RagTeach.

Orchestrates the complete RAG pipeline:
1. PDF ingestion with PyMuPDF + Parent-Child chunking
2. Multi-provider embeddings (Ollama / OpenAI / Gemini / fallback)
3. LanceDB vector storage with pre-filtered search
4. Hybrid BM25 + Dense Vector search with RRF fusion
5. FlashRank cross-encoder reranking
6. MMR diversity filtering
7. Rich context assembly with source citations
"""

from __future__ import annotations

import json
import asyncio
import logging
import uuid
from pathlib import Path
from typing import Any

import fitz  # PyMuPDF
import numpy as np
import pyarrow as pa

from app.core.config import settings
from app.core.models import AppSettings, ChunkHit, CourseMeta
from app.core.settings_store import store
from app.rag.chunker import DocumentChunk, SemanticChunker, extract_topics_from_toc
from app.rag.embedder import (
    TARGET_DIM,
    create_embedding_provider,
    generate_fallback_embedding,
)
from app.rag.hybrid_search import hybrid_engine
from app.rag.turkish_nlp import normalize_text

logger = logging.getLogger(__name__)


class ProductionRagService:
    """
    Production-grade RAG service with hybrid retrieval.
    
    Architecture:
    - Parent-child chunk indexing: child chunks (small, precise) are embedded for search,
      parent chunks (large, contextual) are returned to the LLM.
    - Hybrid search: BM25 lexical + Dense vector + RRF + Reranking + MMR
    - Multi-provider embeddings: Ollama (offline) or OpenAI/Gemini (online)
    """

    def __init__(self) -> None:
        self._ingest_lock = asyncio.Lock()
        self._db = None
        self._child_table = None  # LanceDB table for child chunks (search index)
        self._parent_table = None  # LanceDB table for parent chunks (context store)
        self._courses_path = settings.settings_dir / "courses.json"
        self._chunker = SemanticChunker(
            child_chunk_size=300,
            parent_chunk_size=1200,
            child_overlap=50,
            parent_overlap=100,
        )
        # In-memory caches for fast BM25 + MMR
        self._child_texts: dict[str, list[str]] = {}  # course_id -> [text, ...]
        self._child_records: dict[str, list[dict]] = {}  # course_id -> [record_dict, ...]
        self._parent_records: dict[str, list[dict]] = {}  # course_id -> [record_dict, ...]
        self._child_vectors: dict[str, list[list[float]]] = {}  # course_id -> [vec, ...]

    # ── Database Connection ──────────────────────────────────────────────

    def _ensure_db(self):
        """Lazy-initialize LanceDB connection."""
        if self._db is not None:
            return
        import lancedb

        self._db = lancedb.connect(str(settings.lance_dir))
        names = self._db.table_names()

        if "child_chunks" in names:
            self._child_table = self._db.open_table("child_chunks")
        if "parent_chunks" in names:
            self._parent_table = self._db.open_table("parent_chunks")

        # Load cached chunk data from courses for BM25 indices
        self._rebuild_bm25_indices()
        # Earlier versions used a single `chunks` table with 384-dimensional
        # vectors. Keep those libraries searchable without changing their data
        # or mixing their vectors with the newer 768-dimensional index.
        if "chunks" in names:
            legacy = self._db.open_table("chunks").to_arrow().to_pylist()
            grouped: dict[str, list[dict]] = {}
            for row in legacy:
                grouped.setdefault(row["course_id"], []).append(row)
            for cid, records in grouped.items():
                if cid in self._child_records:
                    continue
                for row in records:
                    row.setdefault("parent_id", "")
                    row.setdefault("chapter_title", "")
                    row.setdefault("section", "")
                    row.setdefault("chunk_type", "theory")
                self._child_records[cid] = records
                self._parent_records[cid] = records
                self._child_texts[cid] = [r["text"] for r in records]
                self._child_vectors[cid] = [r.get("vector", []) for r in records]
                hybrid_engine.build_bm25_index(cid, self._child_texts[cid])

    def _rebuild_bm25_indices(self):
        """Rebuild BM25 indices from stored chunk data."""
        try:
            if self._child_table is None:
                return

            # Read all child chunks and group by course_id
            all_data = self._child_table.to_pandas()
            if all_data.empty:
                return

            for course_id in all_data["course_id"].unique():
                course_data = all_data[all_data["course_id"] == course_id]
                texts = course_data["text"].tolist()
                self._child_texts[course_id] = texts

                # Build records cache
                records = course_data.to_dict("records")
                self._child_records[course_id] = records

                # Cache vectors
                if "vector" in course_data.columns:
                    self._child_vectors[course_id] = [
                        np.asarray(r.get("vector", []), dtype=float).tolist()
                        for r in records
                    ]

                # Build BM25 index
                hybrid_engine.build_bm25_index(course_id, texts)

            # Also load parent chunks
            if self._parent_table is not None:
                parent_data = self._parent_table.to_pandas()
                if not parent_data.empty:
                    for course_id in parent_data["course_id"].unique():
                        course_parent_data = parent_data[parent_data["course_id"] == course_id]
                        self._parent_records[course_id] = course_parent_data.to_dict("records")

            logger.info(f"BM25 indices rebuilt for {len(self._child_texts)} courses")
        except Exception as e:
            logger.warning(f"Failed to rebuild BM25 indices: {e}")

    # ── Course Management ────────────────────────────────────────────────

    def list_courses(self) -> list[CourseMeta]:
        if not self._courses_path.exists():
            return []
        try:
            data = json.loads(self._courses_path.read_text(encoding="utf-8"))
            courses = [CourseMeta.model_validate(c) for c in data]
            for course in courses:
                path = (settings.pdf_dir / course.filename).resolve()
                course.pdf_available = path.is_relative_to(settings.pdf_dir.resolve()) and path.is_file()
            return courses
        except Exception:
            return []

    def _save_courses(self, courses: list[CourseMeta]) -> None:
        payload = [c.model_dump() for c in courses]
        temporary = self._courses_path.with_suffix(".tmp")
        temporary.write_text(
            json.dumps(payload, indent=2, ensure_ascii=False),
            encoding="utf-8",
        )

        temporary.replace(self._courses_path)

    # ── Embedding Provider Resolution ────────────────────────────────────

    def _resolve_embedder(self):
        """
        Resolve the best available embedding provider.
        Priority: Online API (if key available) > Ollama > Fallback hash
        """
        app = store.load_settings()
        embedding_cfg = app.embedding

        # Check if we should use online provider
        if embedding_cfg.mode == "online":
            key = store.get_key(embedding_cfg.api_key_ref)
            if key:
                return create_embedding_provider(
                    provider=embedding_cfg.provider,
                    model=embedding_cfg.model,
                    api_key=key,
                )

        # Honor the configured mode; never silently use an unrelated cloud key.
        if embedding_cfg.mode == "online":
            raise ValueError("Embedding sağlayıcısı için API anahtarı eksik.")
        return create_embedding_provider(
            provider=embedding_cfg.provider,
            model=embedding_cfg.model or "nomic-embed-text",
        )

    # ── PDF Ingestion Pipeline ───────────────────────────────────────────

    async def ingest_pdf(self, file_path: Path, title: str | None = None, on_progress: Any = None) -> CourseMeta:
        # Serialize table creation and metadata publication across concurrent uploads.
        async with self._ingest_lock:
            return await self._ingest_pdf(file_path, title, on_progress)

    async def _ingest_pdf(
        self,
        file_path: Path,
        title: str | None = None,
        on_progress: Any = None,
    ) -> CourseMeta:
        """
        Production PDF ingestion pipeline:
        1. Extract text with PyMuPDF
        2. Extract TOC structure
        3. Parent-child chunking with metadata
        4. Batch embedding with best available provider
        5. LanceDB storage
        6. BM25 index construction
        """
        self._ensure_db()

        course_id = uuid.uuid4().hex[:12]
        book_title = title or file_path.stem.replace("_", " ").replace("-", " ").title()

        # Always close the PDF, including extraction failures.
        with fitz.open(str(file_path)) as doc:
            if doc.needs_pass:
                raise ValueError("Şifreli PDF desteklenmiyor. Şifresiz bir kopya yükleyin.")
            parent_chunks, child_chunks, page_texts = self._chunker.chunk_document(doc, course_id, book_title)
            topics = extract_topics_from_toc(doc, page_texts)
        if not child_chunks:
            raise ValueError("PDF içinde okunabilir metin bulunamadı. Taranmış belgelerde önce OCR uygulayın.")

        logger.info(
            f"PDF ingested: {len(page_texts)} pages, "
            f"{len(parent_chunks)} parent chunks, "
            f"{len(child_chunks)} child chunks"
        )

        # 4. Generate embeddings for child chunks (these are what we search against)
        child_texts = [c.text for c in child_chunks]

        embedding_space = "lexical"
        try:
            embedder = self._resolve_embedder()
            child_vectors = await embedder.embed_batch(child_texts)
            if len(child_vectors) != len(child_texts):
                raise ValueError("Embedding count mismatch")
            embedding_space = f"{type(embedder).__name__}:{getattr(embedder, 'model', '')}"
        except Exception as e:
            logger.warning(f"Embedding failed: {e}, using fallback")
            child_vectors = [generate_fallback_embedding(t) for t in child_texts]

        # 5. Store in LanceDB
        self._store_chunks(course_id, parent_chunks, child_chunks, child_vectors)

        # 6. Build BM25 index for this course
        self._child_texts[course_id] = child_texts
        self._child_records[course_id] = [
            {**c.to_dict(), "vector": child_vectors[i]}
            for i, c in enumerate(child_chunks)
        ]
        self._parent_records[course_id] = [c.to_dict() for c in parent_chunks]
        self._child_vectors[course_id] = child_vectors

        hybrid_engine.build_bm25_index(course_id, child_texts)

        # 7. Save course metadata
        meta = CourseMeta(
            id=course_id,
            title=book_title,
            filename=file_path.name,
            page_count=len(page_texts),
            chunk_count=len(child_chunks),
            topics=topics,
            embedding_space=embedding_space,
        )
        courses = self.list_courses()
        courses.insert(0, meta)
        self._save_courses(courses)

        # Update active course in settings
        app = store.load_settings()
        app.rag.course_id = course_id
        store.save_settings(app)

        logger.info(f"Course '{book_title}' indexed: {meta.chunk_count} chunks, {meta.page_count} pages")
        return meta

    def _store_chunks(
        self,
        course_id: str,
        parent_chunks: list[DocumentChunk],
        child_chunks: list[DocumentChunk],
        child_vectors: list[list[float]],
    ) -> None:
        """Store parent and child chunks in LanceDB."""

        # ── Child chunks table (with vectors for search) ──
        if child_chunks:
            child_data = {
                "id": [c.id for c in child_chunks],
                "course_id": [c.course_id for c in child_chunks],
                "page": [c.metadata.page_number for c in child_chunks],
                "text": [c.text for c in child_chunks],
                "chapter_title": [c.metadata.chapter_title for c in child_chunks],
                "section": [c.metadata.section for c in child_chunks],
                "chunk_type": [c.metadata.chunk_type for c in child_chunks],
                "parent_id": [c.metadata.parent_id or "" for c in child_chunks],
                "vector": child_vectors,
            }
            # LanceDB needs a fixed-size float vector, not Arrow's inferred variable list.
            child_data["vector"] = pa.array(child_vectors, type=pa.list_(pa.float32(), TARGET_DIM))
            arrow = pa.Table.from_pydict(child_data)

            if self._child_table is None:
                self._child_table = self._db.create_table("child_chunks", arrow)
            else:
                self._child_table.add(arrow)

        # ── Parent chunks table (no vectors, just text for LLM context) ──
        if parent_chunks:
            parent_data = {
                "id": [p.id for p in parent_chunks],
                "course_id": [p.course_id for p in parent_chunks],
                "page": [p.metadata.page_number for p in parent_chunks],
                "text": [p.text for p in parent_chunks],
                "chapter_title": [p.metadata.chapter_title for p in parent_chunks],
                "section": [p.metadata.section for p in parent_chunks],
                "chunk_type": [p.metadata.chunk_type for p in parent_chunks],
            }
            arrow = pa.Table.from_pydict(parent_data)

            if self._parent_table is None:
                self._parent_table = self._db.create_table("parent_chunks", arrow)
            else:
                self._parent_table.add(arrow)

    # ── Hybrid Search Pipeline ───────────────────────────────────────────

    async def search(
        self,
        query: str,
        course_id: str | None = None,
        top_k: int | None = None,
        overview: bool = False,
    ) -> list[ChunkHit]:
        """
        Production hybrid search:
        1. BM25 lexical search (Turkish-aware)
        2. Dense vector search (LanceDB)
        3. RRF fusion
        4. FlashRank reranking
        5. MMR diversity
        6. Parent chunk expansion (return parent context for child matches)
        """
        self._ensure_db()
        if not self._child_records:
            return []

        app = store.load_settings()
        k = max(1, min(20, top_k or app.rag.top_k or 5))
        cid = course_id or app.rag.course_id

        if not cid:
            return []

        course = next((c for c in self.list_courses() if c.id == cid), None)
        if course is None:
            raise ValueError("Belge bulunamadı.")
        if overview:
            # Explicit document-summary actions sample across the document;
            # they do not pretend a generic prompt was a relevant keyword hit.
            parents = sorted(self._parent_records.get(cid, []), key=lambda row: row.get("page", 0))
            indices = np.linspace(0, len(parents) - 1, min(k, len(parents)), dtype=int) if parents else []
            return [ChunkHit(text=parents[i]["text"], page=int(parents[i].get("page", 1)), course_id=cid,
                             chapter_title=parents[i].get("chapter_title", ""), score=0.0) for i in indices]
        query = query.strip()
        if not query:
            return []
        # Only compare vectors produced in the same embedding space. Old or
        # unavailable models retain useful BM25 search without random vector hits.
        q_vec = None
        if course.embedding_space and course.embedding_space != "lexical":
            try:
                embedder = self._resolve_embedder()
                space = f"{type(embedder).__name__}:{getattr(embedder, 'model', '')}"
                if space == course.embedding_space:
                    q_vec = await embedder.embed_single(query)
            except Exception as exc:
                logger.warning("Dense search unavailable; using BM25: %s", exc)

        # 2. Dense vector search with pre-filtering by course_id
        vector_results: list[tuple[int, float]] = []
        try:
            if q_vec is None:
                raise ValueError("No compatible embedding; lexical search only")
            safe_cid = cid.replace("'", "''")
            lancedb_results = (
                self._child_table
                .search(q_vec)
                .where(f"course_id = '{safe_cid}'", prefilter=True)
                .limit(k * 6)
                .to_list()
            )

            # Map LanceDB results to indices in our cached records
            cached_records = self._child_records.get(cid, [])
            if cached_records:
                record_id_map = {r.get("id", ""): idx for idx, r in enumerate(cached_records)}
                for row in lancedb_results:
                    row_id = row.get("id", "")
                    if row_id in record_id_map:
                        dist = float(row.get("_distance", 1.0))
                        vector_results.append((record_id_map[row_id], dist))
            else:
                # No cache; create temporary index from LanceDB results
                for i, row in enumerate(lancedb_results):
                    dist = float(row.get("_distance", 1.0))
                    vector_results.append((i, dist))
                cached_records = [dict(row) for row in lancedb_results]
                self._child_records[cid] = cached_records

        except Exception as e:
            logger.warning(f"LanceDB vector search failed: {e}")

        # 3. Hybrid search (BM25 + Dense + RRF + Reranking + MMR)
        cached_chunks = self._child_records.get(cid, [])
        cached_vectors = self._child_vectors.get(cid, [])

        if not cached_chunks and not vector_results:
            return []

        selected_indices = hybrid_engine.hybrid_search(
            query=query,
            query_vec=q_vec or [],
            course_id=cid,
            vector_results=vector_results,
            top_k=min(k * 3, 20),
            enable_reranking=settings.enable_reranking,
            enable_mmr=q_vec is not None,
            all_chunks=cached_chunks,
            all_vectors=cached_vectors,
        )

        # 4. Parent chunk expansion: for each selected child, find its parent
        hits: list[ChunkHit] = []
        seen_parents: set[str] = set()
        parent_records = self._parent_records.get(cid, [])

        for idx in selected_indices:
            if idx >= len(cached_chunks):
                continue

            child = cached_chunks[idx]
            parent_id = child.get("parent_id", "")

            if parent_id and parent_id in seen_parents:
                continue

            # Find the parent chunk for richer LLM context
            context_text = child.get("text", "")
            context_page = int(child.get("page", 1))
            if parent_id and parent_id not in seen_parents and parent_records:
                parent = next((p for p in parent_records if p.get("id") == parent_id), None)
                if parent:
                    context_text = parent.get("text", context_text)
                    context_page = int(parent.get("page", context_page))
                    seen_parents.add(parent_id)

            # Compute a display score
            bm25_results = hybrid_engine.bm25_search(query, cid, top_k=30)
            bm25_score = 0.0
            for bm25_idx, bm25_s in bm25_results:
                if bm25_idx == idx:
                    bm25_score = bm25_s
                    break

            vec_score = 0.0
            for v_idx, v_dist in vector_results:
                if v_idx == idx:
                    vec_score = 1.0 / (1.0 + max(0.0, v_dist))
                    break

            combined_score = max(0.01, 0.5 * vec_score + 0.5 * (bm25_score / max(1, bm25_score + 1)))

            hits.append(ChunkHit(
                text=context_text,
                page=context_page,
                course_id=child.get("course_id", cid),
                score=round(combined_score, 4),
                chapter_title=child.get("chapter_title", ""),
                section=child.get("section", ""),
                chunk_type=child.get("chunk_type", "theory"),
            ))

        # Preserve the retrieval/reranker ordering.
        return hits[:k]

    # ── Context Assembly for LLM ─────────────────────────────────────────

    def build_context(self, hits: list[ChunkHit]) -> str:
        """
        Build rich context string from search results for LLM consumption.
        Each hit is formatted with source citation metadata.
        """
        if not hits:
            return ""

        parts: list[str] = []
        for i, h in enumerate(hits, 1):
            header_parts = []
            if h.chapter_title:
                header_parts.append(f"Bölüm: {h.chapter_title}")
            if h.section:
                header_parts.append(f"Kısım: {h.section}")
            if h.page > 0:
                header_parts.append(f"Sayfa: {h.page}")
            header_parts.append(f"Alaka: {h.score:.2f}")

            header = " | ".join(header_parts)
            parts.append(f"[Kaynak {i}: {header}]\n\"{h.text}\"")

        return "\n\n---\n\n".join(parts)


# ── Singleton ────────────────────────────────────────────────────────────────
rag_service = ProductionRagService()
