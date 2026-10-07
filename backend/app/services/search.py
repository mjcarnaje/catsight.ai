"""Hybrid retrieval over DocumentChunk: semantic + keyword, fused, reranked.

    query ─┬─► vector leg   cosine distance on embeddings   (meaning: "who was put in charge of e-learning?")
           └─► keyword leg  Postgres full-text, OR of terms (exact tokens: "SO 01592-2023", surnames)
                 │
                 ▼  Reciprocal Rank Fusion (rank-based, so the two legs' scores never need calibrating)
                 ▼  optional cross-encoder rerank (OpenRouter /rerank)
                 ▼  relevance gate + at most MAX_PER_DOCUMENT passages per document

Dense embeddings blur exact identifiers and names, which is most of what people
type when looking for a special order; full-text alone misses paraphrases.
Each leg covers the other's blind spot.
"""
from __future__ import annotations

import logging
import re
from collections import defaultdict
from dataclasses import dataclass, field
from typing import Iterable, Optional

from django.conf import settings
from django.contrib.postgres.search import SearchQuery, SearchRank
from django.db import connection
from django.db.models import F, QuerySet
from pgvector.django import CosineDistance

from ..constant import DocumentStatus
from ..models import Document, DocumentChunk
from . import llm

logger = logging.getLogger(__name__)

FTS_CONFIG = "english"
CANDIDATES = 30  # per leg, before fusion
RRF_K = 60  # standard RRF damping: a rank-1 hit scores 1/61, rank-10 1/70
RERANK_TOP = 20  # fused candidates the cross-encoder re-scores
MAX_PER_DOCUMENT = 3

MIN_RERANK_SCORE = 0.05  # cross-encoder relevance (0-1) below which a passage is dropped

_TOKEN_RE = re.compile(r"[^\W_]+", re.UNICODE)
_LEADING_ZEROS_RE = re.compile(r"\b0+(\d)")


@dataclass
class Hit:
    chunk: DocumentChunk
    score: float = 0.0  # final ordering score (fused, or reranker relevance)
    similarity: Optional[float] = None  # cosine similarity, when the vector leg found it
    keyword_rank: Optional[float] = None  # ts_rank_cd, when the keyword leg found it
    ranks: dict[str, int] = field(default_factory=dict)  # 1-based rank per leg

    @property
    def document(self) -> Document:
        return self.chunk.document


# --- Text normalisation (shared by indexing and querying) ----------------------------
def normalize_for_search(text: str) -> str:
    """Strip leading zeros from numbers so "SO 1592" matches "SO 01592"."""
    return _LEADING_ZEROS_RE.sub(r"\1", text)


def keyword_terms(query: str) -> list[str]:
    """Distinct alphanumeric terms; hyphens split ("01592-2023" -> 1592, 2023)."""
    seen: dict[str, None] = {}
    for token in _TOKEN_RE.findall(normalize_for_search(query).lower()):
        if len(token) > 1 or token.isdigit():
            seen.setdefault(token, None)
    return list(seen)


def update_search_vectors(chunks: Iterable[DocumentChunk]) -> None:
    """(Re)compute each chunk's tsvector: context weighted A, passage text B."""
    rows = [(normalize_for_search(c.context), normalize_for_search(c.text), c.pk) for c in chunks]
    if not rows:
        return
    with connection.cursor() as cursor:
        cursor.executemany(
            f"""
            UPDATE app_documentchunk
            SET search_vector = setweight(to_tsvector('{FTS_CONFIG}', %s), 'A')
                             || setweight(to_tsvector('{FTS_CONFIG}', %s), 'B')
            WHERE id = %s
            """,
            rows,
        )


# --- Scope ----------------------------------------------------------------------------
def searchable_documents(
    user,
    document_ids: Optional[list[int]] = None,
    years: Optional[list[int]] = None,
    tag_ids: Optional[list[int]] = None,
) -> QuerySet[Document]:
    """Ready documents the user may see, narrowed by the optional filters.

    A document matches if it has any selected year and any selected tag. Filters
    read the Document row, so edits to its year or tags apply immediately.
    """
    docs = Document.objects.visible_to(user).filter(status=DocumentStatus.READY.value, is_failed=False)
    if document_ids:
        docs = docs.filter(id__in=document_ids)
    if years:
        docs = docs.filter(year__in=years)
    if tag_ids:
        docs = docs.filter(tags__id__in=tag_ids)
    return docs.distinct()


# --- Legs -----------------------------------------------------------------------------
def _vector_leg(chunks: QuerySet, query_vector: list[float]) -> list[tuple[int, float]]:
    rows = (
        chunks.annotate(distance=CosineDistance("embedding", query_vector))
        .order_by("distance")
        .values_list("id", "distance")[:CANDIDATES]
    )
    return [(chunk_id, 1.0 - distance) for chunk_id, distance in rows]


def _keyword_leg(chunks: QuerySet, query: str) -> list[tuple[int, float]]:
    terms = keyword_terms(query)
    if not terms:
        return []
    # OR of terms: a question rarely contains every word of the passage that answers it.
    # Stop words drop out inside to_tsquery; ranking rewards passages matching more terms.
    ts_query = SearchQuery(" | ".join(terms), search_type="raw", config=FTS_CONFIG)
    rows = (
        chunks.filter(search_vector=ts_query)
        .annotate(rank=SearchRank(F("search_vector"), ts_query, cover_density=True))
        .order_by("-rank")
        .values_list("id", "rank")[:CANDIDATES]
    )
    return list(rows)


def fuse(legs: dict[str, list[tuple[int, float]]], k: int = RRF_K) -> list[tuple[int, float, dict[str, int]]]:
    """Reciprocal Rank Fusion: score = sum over legs of 1 / (k + rank).

    Returns (chunk id, fused score, {leg: rank}) sorted best first. Only ranks
    matter, so cosine similarities and ts_rank values never have to share a scale.
    """
    scores: dict[int, float] = defaultdict(float)
    ranks: dict[int, dict[str, int]] = defaultdict(dict)
    for leg, results in legs.items():
        for position, (chunk_id, _score) in enumerate(results, start=1):
            scores[chunk_id] += 1.0 / (k + position)
            ranks[chunk_id][leg] = position
    return sorted(((cid, s, ranks[cid]) for cid, s in scores.items()), key=lambda item: -item[1])


# --- Reranking ------------------------------------------------------------------------
def _rerank(query: str, hits: list[Hit]) -> list[Hit]:
    """Reorder by a cross-encoder's relevance; on any failure keep the fused order."""
    if not hits or not settings.RERANKER_MODEL or not llm.is_openrouter():
        return hits
    try:
        scores = llm.rerank(query, [f"{h.chunk.context}\n{h.chunk.text}" for h in hits])
    except Exception:
        logger.warning("Reranking failed; keeping the fused order", exc_info=True)
        return hits
    for hit, score in zip(hits, scores, strict=True):
        hit.score = score
    # A keyword match on an exact identifier stays even if the cross-encoder shrugs
    kept = [h for h in hits if h.score >= MIN_RERANK_SCORE or h.keyword_rank is not None]
    return sorted(kept, key=lambda h: -h.score)


# --- Public API -----------------------------------------------------------------------
def search(
    query: str,
    user,
    k: int = 6,
    document_ids: Optional[list[int]] = None,
    years: Optional[list[int]] = None,
    tag_ids: Optional[list[int]] = None,
    per_document: int = MAX_PER_DOCUMENT,
) -> list[Hit]:
    """The k most relevant passages for `query` that `user` may read, at most `per_document` from one document."""
    query = query.strip()
    if not query:
        return []
    docs = searchable_documents(user, document_ids, years, tag_ids)
    chunks = DocumentChunk.objects.filter(document__in=docs)

    vector = _vector_leg(chunks, llm.embed_query(query))
    keyword = _keyword_leg(chunks, query)
    similarity = dict(vector)
    keyword_rank = dict(keyword)
    floor = settings.RETRIEVAL_MIN_SIMILARITY

    fused = fuse({"vector": vector, "keyword": keyword})
    # Vector-only matches must clear the similarity floor; a keyword match always counts.
    fused = [f for f in fused if f[0] in keyword_rank or similarity.get(f[0], 0) >= floor]

    by_id = DocumentChunk.objects.select_related("document").in_bulk([cid for cid, _, _ in fused[:RERANK_TOP]])
    hits = [
        Hit(by_id[cid], score=score, similarity=similarity.get(cid), keyword_rank=keyword_rank.get(cid), ranks=ranks)
        for cid, score, ranks in fused[:RERANK_TOP]
        if cid in by_id
    ]
    hits = _rerank(query, hits)

    taken: dict[int, int] = defaultdict(int)
    results = []
    for hit in hits:
        if taken[hit.chunk.document_id] >= per_document:
            continue
        taken[hit.chunk.document_id] += 1
        results.append(hit)
        if len(results) == k:
            break
    logger.info(
        "search %r: %d vector, %d keyword -> %d results",
        query, len(vector), len(keyword), len(results),
    )
    return results
