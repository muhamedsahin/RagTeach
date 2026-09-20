"""
Hybrid Search Engine for RagTeach RAG.

Implements a state-of-the-art multi-signal retrieval pipeline:

1. BM25 Lexical Search (Turkish-aware stemming + stopwords)
2. Dense Vector Search (LanceDB with pre-filtering)
3. Reciprocal Rank Fusion (RRF, k=60) combining BM25 + Dense rankings
4. FlashRank Cross-Encoder Reranking (CPU-optimized, ~100MB model)
5. Maximal Marginal Relevance (MMR, λ=0.7) for diversity
6. HyDE Query Expansion (optional, LLM-powered)
"""

from __future__ import annotations

import logging
import re
from collections import defaultdict
from typing import Any

import numpy as np

from app.rag.turkish_nlp import preprocess_for_bm25

logger = logging.getLogger(__name__)


# ── BM25 Index ───────────────────────────────────────────────────────────────

class BM25Index:
    """
    Okapi BM25 ranking function with Turkish-aware preprocessing.
    
    Parameters:
        k1: Term frequency saturation parameter (default 1.5)
        b:  Document length normalization (default 0.75)
    """

    def __init__(self, k1: float = 1.5, b: float = 0.75):
        self.k1 = k1
        self.b = b
        self.doc_count: int = 0
        self.avg_doc_len: float = 0.0
        self.doc_lengths: list[int] = []
        self.doc_term_freqs: list[dict[str, int]] = []
        self.doc_freq: dict[str, int] = defaultdict(int)  # term -> number of docs containing it
        self._built = False

    def build(self, documents: list[str]) -> None:
        """Build BM25 index from a list of document texts."""
        self.doc_count = len(documents)
        self.doc_lengths = []
        self.doc_term_freqs = []
        self.doc_freq = defaultdict(int)

        total_len = 0

        for doc_text in documents:
            tokens = preprocess_for_bm25(doc_text)
            self.doc_lengths.append(len(tokens))
            total_len += len(tokens)

            # Term frequency within this document
            tf: dict[str, int] = defaultdict(int)
            for token in tokens:
                tf[token] += 1
            self.doc_term_freqs.append(dict(tf))

            # Document frequency (unique terms)
            for unique_term in set(tokens):
                self.doc_freq[unique_term] += 1

        self.avg_doc_len = total_len / max(1, self.doc_count)
        self._built = True

    def search(self, query: str, top_k: int = 30) -> list[tuple[int, float]]:
        """
        Score all documents against the query using BM25.
        
        Returns list of (doc_index, bm25_score) sorted descending.
        """
        if not self._built or self.doc_count == 0:
            return []

        query_tokens = preprocess_for_bm25(query)
        if not query_tokens:
            return []

        scores: list[float] = [0.0] * self.doc_count

        for term in query_tokens:
            if term not in self.doc_freq:
                continue

            df = self.doc_freq[term]
            # IDF with log smoothing
            idf = np.log(1 + (self.doc_count - df + 0.5) / (df + 0.5))

            for doc_idx in range(self.doc_count):
                tf = self.doc_term_freqs[doc_idx].get(term, 0)
                if tf == 0:
                    continue

                doc_len = self.doc_lengths[doc_idx]
                # BM25 scoring formula
                numerator = tf * (self.k1 + 1)
                denominator = tf + self.k1 * (1 - self.b + self.b * doc_len / max(1, self.avg_doc_len))
                scores[doc_idx] += idf * (numerator / denominator)

        # Get top-K scored documents
        scored_indices = [(idx, score) for idx, score in enumerate(scores) if score > 0]
        scored_indices.sort(key=lambda x: x[1], reverse=True)
        return scored_indices[:top_k]


# ── Reciprocal Rank Fusion ───────────────────────────────────────────────────

def reciprocal_rank_fusion(
    *ranked_lists: list[tuple[int, float]],
    k: int = 60,
) -> list[tuple[int, float]]:
    """
    Combine multiple ranked lists using Reciprocal Rank Fusion (RRF).
    
    RRF_Score(d) = Σ 1/(k + rank_m(d)) for each ranking m
    
    Args:
        *ranked_lists: Variable number of ranked lists, each as [(doc_id, score), ...]
        k: RRF constant (default 60, standard in literature)
    
    Returns:
        Fused list of (doc_id, rrf_score) sorted descending.
    """
    scores: dict[int, float] = defaultdict(float)

    for ranked_list in ranked_lists:
        for rank, (doc_id, _score) in enumerate(ranked_list):
            scores[doc_id] += 1.0 / (k + rank + 1)

    fused = sorted(scores.items(), key=lambda x: x[1], reverse=True)
    return fused


# ── Maximal Marginal Relevance ───────────────────────────────────────────────

def maximal_marginal_relevance(
    query_vec: list[float],
    candidate_vecs: list[list[float]],
    candidate_ids: list[int],
    candidate_scores: list[float],
    top_k: int = 5,
    lambda_param: float = 0.7,
) -> list[int]:
    """
    Maximal Marginal Relevance (MMR) for diversity filtering.
    
    MMR = argmax_{d_i} [ λ * Sim(d_i, q) - (1-λ) * max_{d_j ∈ S} Sim(d_i, d_j) ]
    
    Args:
        query_vec: Query embedding vector
        candidate_vecs: Candidate document vectors
        candidate_ids: Candidate document IDs
        candidate_scores: Pre-computed relevance scores
        top_k: Number of results to return
        lambda_param: Balance between relevance (1.0) and diversity (0.0)
    
    Returns:
        List of selected document IDs.
    """
    if not candidate_ids:
        return []

    q = np.array(query_vec, dtype=np.float64)
    vecs = np.array(candidate_vecs, dtype=np.float64) if candidate_vecs else np.zeros((len(candidate_ids), 1))

    selected: list[int] = []
    remaining = list(range(len(candidate_ids)))

    for _ in range(min(top_k, len(remaining))):
        best_score = -float("inf")
        best_idx = -1

        for idx in remaining:
            # Relevance score
            relevance = candidate_scores[idx]

            # Max similarity to already selected
            max_sim_to_selected = 0.0
            if selected and vecs.shape[1] > 1:
                for sel_idx in selected:
                    sim = float(np.dot(vecs[idx], vecs[sel_idx]))
                    max_sim_to_selected = max(max_sim_to_selected, sim)

            # MMR score
            mmr = lambda_param * relevance - (1 - lambda_param) * max_sim_to_selected

            if mmr > best_score:
                best_score = mmr
                best_idx = idx

        if best_idx >= 0:
            selected.append(best_idx)
            remaining.remove(best_idx)

    return [candidate_ids[i] for i in selected]


# ── FlashRank Cross-Encoder Reranker ─────────────────────────────────────────

_flashrank_ranker = None


def _get_flashrank_ranker():
    """Lazy-load FlashRank cross-encoder reranker (CPU-optimized, ~100MB)."""
    global _flashrank_ranker
    if _flashrank_ranker is None:
        try:
            from flashrank import Ranker, RerankRequest
            _flashrank_ranker = Ranker(model_name="ms-marco-MultiBERT-L-12", cache_dir="data/models")
            logger.info("FlashRank cross-encoder loaded successfully")
        except ImportError:
            logger.warning("FlashRank not installed, reranking disabled (pip install flashrank)")
            _flashrank_ranker = "unavailable"
        except Exception as e:
            logger.warning(f"FlashRank failed to load: {e}")
            _flashrank_ranker = "unavailable"
    return _flashrank_ranker


def crossencoder_rerank(
    query: str,
    documents: list[dict[str, Any]],
    text_key: str = "text",
    top_k: int = 5,
) -> list[dict[str, Any]]:
    """
    Rerank documents using FlashRank cross-encoder.
    
    Falls back to identity (no reranking) if FlashRank is unavailable.
    
    Args:
        query: The search query
        documents: List of document dicts, each must have a `text_key` field
        text_key: Key in document dict containing the text
        top_k: Number of top results to return
    
    Returns:
        Reranked list of documents (top_k).
    """
    ranker = _get_flashrank_ranker()

    if ranker == "unavailable" or not documents:
        return documents[:top_k]

    try:
        from flashrank import RerankRequest

        passages = [{"id": i, "text": doc.get(text_key, "")} for i, doc in enumerate(documents)]
        request = RerankRequest(query=query, passages=passages)
        results = ranker.rerank(request)

        # Results are sorted by score descending
        reranked_indices = [int(r["id"]) for r in results[:top_k]]
        return [documents[i] for i in reranked_indices]

    except Exception as e:
        logger.warning(f"FlashRank reranking failed: {e}, returning unreranked results")
        return documents[:top_k]


# ── Hybrid Search Pipeline ───────────────────────────────────────────────────

class HybridSearchEngine:
    """
    Complete hybrid search pipeline combining:
    1. BM25 lexical search
    2. Dense vector search
    3. RRF fusion
    4. Cross-encoder reranking
    5. MMR diversity filtering
    """

    def __init__(self):
        self.bm25_indices: dict[str, BM25Index] = {}  # course_id -> BM25Index

    def build_bm25_index(self, course_id: str, texts: list[str]) -> None:
        """Build or rebuild BM25 index for a course."""
        index = BM25Index(k1=1.5, b=0.75)
        index.build(texts)
        self.bm25_indices[course_id] = index
        logger.info(f"BM25 index built for course {course_id}: {len(texts)} documents")

    def bm25_search(self, query: str, course_id: str, top_k: int = 30) -> list[tuple[int, float]]:
        """Search using BM25 index for a specific course."""
        index = self.bm25_indices.get(course_id)
        if not index:
            return []
        return index.search(query, top_k=top_k)

    def hybrid_search(
        self,
        query: str,
        query_vec: list[float],
        course_id: str,
        vector_results: list[tuple[int, float]],
        top_k: int = 5,
        enable_reranking: bool = True,
        enable_mmr: bool = True,
        all_chunks: list[dict[str, Any]] | None = None,
        all_vectors: list[list[float]] | None = None,
    ) -> list[int]:
        """
        Full hybrid search pipeline.
        
        Args:
            query: Search query text
            query_vec: Query embedding vector
            course_id: Course ID to search within
            vector_results: Pre-computed dense vector search results [(chunk_idx, distance), ...]
            top_k: Final number of results
            enable_reranking: Whether to use FlashRank reranking
            enable_mmr: Whether to apply MMR diversity
            all_chunks: Full chunk list (needed for reranking)
            all_vectors: Full vector list (needed for MMR)
        
        Returns:
            List of chunk indices (top_k).
        """
        # 1. BM25 search
        bm25_results = self.bm25_search(query, course_id, top_k=30)

        # 2. Convert vector distances to (id, score) format
        # LanceDB returns distances (lower = better), convert to scores
        dense_results = [
            (idx, 1.0 / (1.0 + max(0.0, dist)))
            for idx, dist in vector_results
        ]

        # 3. Reciprocal Rank Fusion
        fused = reciprocal_rank_fusion(bm25_results, dense_results, k=60)

        # Take top-25 candidates for reranking
        candidate_ids = [doc_id for doc_id, _ in fused[:25]]
        candidate_scores = {doc_id: score for doc_id, score in fused[:25]}

        if not candidate_ids:
            return []

        # 4. Cross-Encoder Reranking (if enabled and chunks available)
        if enable_reranking and all_chunks:
            candidate_docs = [
                {"idx": idx, "text": all_chunks[idx].get("text", "") if idx < len(all_chunks) else ""}
                for idx in candidate_ids
            ]
            reranked = crossencoder_rerank(query, candidate_docs, text_key="text", top_k=min(10, len(candidate_ids)))
            candidate_ids = [doc["idx"] for doc in reranked]

        # 5. MMR Diversity (if enabled and vectors available)
        if enable_mmr and all_vectors and len(candidate_ids) > top_k:
            candidate_vecs = [
                all_vectors[idx] if idx < len(all_vectors) else [0.0] * len(query_vec)
                for idx in candidate_ids
            ]
            scores_list = [candidate_scores.get(idx, 0.0) for idx in candidate_ids]

            selected_ids = maximal_marginal_relevance(
                query_vec=query_vec,
                candidate_vecs=candidate_vecs,
                candidate_ids=candidate_ids,
                candidate_scores=scores_list,
                top_k=top_k,
                lambda_param=0.7,
            )
            return selected_ids

        return candidate_ids[:top_k]


# ── Singleton ────────────────────────────────────────────────────────────────
hybrid_engine = HybridSearchEngine()

