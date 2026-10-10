"""Turn a document's Markdown into searchable DocumentChunks."""
from __future__ import annotations

import logging
from typing import Callable, Optional

from django.db import transaction

from ..models import Document, DocumentChunk
from ..utils.chunking import split_markdown
from . import llm
from .llm import ModelSettings
from .search import update_search_vectors

logger = logging.getLogger(__name__)

EMBED_BATCH = 32


def chunk_context(document: Document) -> str:
    """The header every chunk of `document` is embedded and indexed with."""
    parts = [document.title or document.file_name]
    if document.reference_number:
        parts.append(document.reference_number)
    if document.year:
        parts.append(str(document.year))
    return " · ".join(p for p in parts if p)[:500]


def index_document(
    document: Document,
    markdown: str,
    cfg: ModelSettings,
    on_progress: Optional[Callable[[int, int], None]] = None,
) -> int:
    """Replace the document's chunks with fresh ones embedded by `cfg`; returns how many were stored.

    Embeddings are computed before anything is deleted, so a failed embedding
    request leaves the previous index searchable. The document records which
    embedding model made its vectors (Document.embedding_model), in the same
    transaction as the new chunks.
    """
    pieces = split_markdown(markdown)
    if not pieces:
        raise ValueError("The document has no text to index.")

    context = chunk_context(document)
    texts = [f"{context}\n{piece.text}" for piece in pieces]
    vectors: list[list[float]] = []
    for start in range(0, len(texts), EMBED_BATCH):
        vectors.extend(llm.embed_documents(cfg, texts[start:start + EMBED_BATCH]))
        if on_progress:
            on_progress(len(vectors), len(texts))

    chunks = [
        DocumentChunk(
            document=document,
            index=i,
            page=piece.page,
            section=(piece.section or "")[:255],
            context=context,
            text=piece.text,
            embedding=vector,
        )
        for i, (piece, vector) in enumerate(zip(pieces, vectors, strict=True))
    ]
    with transaction.atomic():
        DocumentChunk.objects.filter(document=document).delete()
        created = DocumentChunk.objects.bulk_create(chunks)
        update_search_vectors(created)
        document.embedding_model = cfg.embedding_signature
        document.save(update_fields=["embedding_model"])
    logger.info(f"Indexed document {document.id}: {len(created)} chunks")
    return len(created)
