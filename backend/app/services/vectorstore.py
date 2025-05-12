from langchain_postgres import PGVector
from app.services.ollama import BGEM3_EMBEDDINGS
from langchain_core.tools.simple import Tool
from ..models import Document
from typing import Any, Dict, List, Tuple
import logging

logger = logging.getLogger(__name__)

DB_URI = "postgresql+psycopg://postgres:postgres@db:5432/app_db"

vector_store = PGVector(
    embeddings=BGEM3_EMBEDDINGS,
    collection_name="docs_chunks",
    connection=DB_URI,
    use_jsonb=True,
)

retriever = vector_store.as_retriever()



from langchain_core.tools.simple import Tool
from pydantic import BaseModel, Field

class RetrieverInput(BaseModel):
    """Input to the retriever."""
    query: str = Field(description="Query to look up in the retriever")

def get_documents(query: str, retriever) -> List[Dict[str, Any]]:
    """
    Execute the query via retriever and group chunks by document.
    """
    # Get documents from retriever
    docs = retriever.invoke(query)

    # Group by document
    sources_map: Dict[Any, Dict[str, Any]] = {}
    logger.info(f"GETTING DOCUMENTS: {docs}")
    for doc in docs:
        doc_id = doc.metadata.get("doc_id")
        chunk_index = doc.metadata.get("index")
        snippet = doc.page_content

        if doc_id is None:
            logger.info(f"DOC ID IS NONE: {doc}")
            continue

        if doc_id not in sources_map:
            try:
                d = Document.objects.get(id=doc_id)
            except Document.DoesNotExist:
                logger.info(f"DOCUMENT DOES NOT EXIST: {doc_id}")
                continue

            sources_map[doc_id] = {
                "id":            d.id,
                "title":         d.title,
                "summary":       d.summary,
                "year":          d.year,
                "tags":          d.tags,
                "file_name":     d.file_name,
                "blurhash":      d.blurhash,
                "preview_image": d.preview_image,
                "file_type":     d.file_type,
                "created_at":    d.created_at.isoformat(),
                "updated_at":    d.updated_at.isoformat(),
                "contents":      [],
            }

        sources_map[doc_id]["contents"].append({
            "snippet":     snippet,
            "chunk_index": chunk_index,
        })

    # Return list of documents
    return list(sources_map.values())


def create_retriever_tool(name: str, description: str, retriever) -> Tool:
    """Creates a Tool for a given retriever with custom name and description."""
    return Tool(
        name=name,
        func=lambda query: get_documents(query, retriever),
        description=description,
        args_schema=RetrieverInput,
    )


retriever_tool = create_retriever_tool(
    name="retrieve",
    description="A tool to retrieve documents from the vector store",
    retriever=retriever,
)
