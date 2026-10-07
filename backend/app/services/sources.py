"""Turn retrieved chunks into "sources" (one per document) for the UI and the LLM."""
import logging
from typing import Any

from langchain_core.documents import Document as Chunk

from ..models import Document

logger = logging.getLogger(__name__)


def sources_from_chunks(chunks: list[Chunk]) -> list[dict[str, Any]]:
    """Group chunks by document, in relevance order, with the document details the UI shows."""
    order: list[int] = []
    by_doc: dict[int, list[Chunk]] = {}
    for chunk in chunks:
        doc_id = chunk.metadata.get("doc_id")
        if doc_id is None:
            continue
        if doc_id not in by_doc:
            order.append(doc_id)
            by_doc[doc_id] = []
        by_doc[doc_id].append(chunk)

    documents = Document.objects.prefetch_related("tags").in_bulk(order)
    sources = []
    for doc_id in order:
        d = documents.get(doc_id)
        if d is None:  # document deleted but its chunks weren't
            logger.info(f"Skipping chunks of missing document {doc_id}")
            continue
        sources.append({
            "id":            d.id,
            "title":         d.title,
            "summary":       d.summary,
            "year":          d.year,
            "tags":          [{"name": t.name, "description": t.description} for t in d.tags.all()],
            "file_name":     d.file_name,
            "blurhash":      d.blurhash,
            "preview_image": d.preview_image,
            "file_type":     d.file_type,
            "created_at":    d.created_at.isoformat(),
            "updated_at":    d.updated_at.isoformat(),
            "contents": [
                {
                    "snippet":     c.page_content,
                    "chunk_index": c.metadata.get("index"),
                    "page":        c.metadata.get("page"),
                    "section":     c.metadata.get("section"),
                }
                for c in by_doc[doc_id]
            ],
        })
    return sources


def format_sources_for_llm(sources: list[dict[str, Any]]) -> str:
    """Compact, citable text for the model; UI-only fields stay out of its context."""
    blocks = []
    for n, source in enumerate(sources, 1):
        year = f" ({source['year']})" if source["year"] else ""
        lines = [f"[{n}] {source['title']}{year}"]
        for content in source["contents"]:
            where = ", ".join(filter(None, [
                content["section"],
                f"p. {content['page']}" if content["page"] else None,
            ]))
            lines.append(f"— {where}:\n{content['snippet']}" if where else f"— {content['snippet']}")
        blocks.append("\n".join(lines))
    return "\n\n".join(blocks)
