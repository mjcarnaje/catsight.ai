import json
from typing import Any, Optional

from django.conf import settings
from django.db import connection
from langchain_core.documents import Document
from langchain_postgres import PGVector

from .ollama import get_embeddings

_db = settings.DATABASES["default"]
DB_URI = (
    f"postgresql+psycopg://{_db['USER']}:{_db['PASSWORD']}"
    f"@{_db['HOST']}:{_db['PORT']}/{_db['NAME']}"
)

COLLECTION_NAME = "docs_chunks"
EMBEDDING_MODEL_ID = settings.EMBEDDING_MODEL

# Chunks scoring below this cosine relevance (0-1) are treated as unrelated.
# Measured with bge-m3 on a refund memo: on-topic queries scored 0.62-0.74 for
# their best chunk, an off-topic query ("basketball tournament schedule") 0.32-0.37.
MIN_RELEVANCE = 0.45

vector_store = PGVector(
    embeddings=get_embeddings(),
    collection_name=COLLECTION_NAME,
    connection=DB_URI,
    use_jsonb=True,
)


def search_chunks(query: str, k: int = 6, filter: Optional[dict] = None) -> list[Document]:
    """Relevant, non-redundant chunks for `query`.

    MMR picks diverse chunks from a wider candidate pool, so one long document
    can't fill every slot with near-identical passages; anything below
    MIN_RELEVANCE is dropped so the LLM isn't fed unrelated text.
    """
    results = vector_store.max_marginal_relevance_search_with_score(
        query, k=k, fetch_k=k * 4, lambda_mult=0.6, filter=filter
    )
    # PGVector returns cosine *distance* (0 = identical); relevance = 1 - distance
    return [doc for doc, distance in results if 1 - distance >= MIN_RELEVANCE]


def get_document_chunks(doc_id: int) -> list[dict[str, Any]]:
    """All stored chunks of a document in reading order (no embedding call needed)."""
    with connection.cursor() as cur:
        cur.execute(
            """
            SELECT e.id, e.document, e.cmetadata
            FROM langchain_pg_embedding e
            JOIN langchain_pg_collection c ON c.uuid = e.collection_id
            WHERE c.name = %s AND e.cmetadata->>'doc_id' = %s
            ORDER BY (e.cmetadata->>'index')::int
            """,
            [COLLECTION_NAME, str(doc_id)],
        )
        # Django's psycopg setup returns jsonb as text, so decode it here
        return [
            {"id": row[0], "content": row[1], "metadata": json.loads(row[2]) if isinstance(row[2], str) else row[2]}
            for row in cur.fetchall()
        ]


def delete_document_chunks(doc_id: int) -> int:
    """Delete every stored chunk of a document; returns how many were removed.

    PGVector.delete() only accepts explicit ids (a `filter=` kwarg is silently
    ignored), so this deletes by the doc_id stored in each chunk's metadata.
    """
    with connection.cursor() as cur:
        cur.execute(
            """
            DELETE FROM langchain_pg_embedding e
            USING langchain_pg_collection c
            WHERE c.uuid = e.collection_id AND c.name = %s AND e.cmetadata->>'doc_id' = %s
            """,
            [COLLECTION_NAME, str(doc_id)],
        )
        return cur.rowcount
