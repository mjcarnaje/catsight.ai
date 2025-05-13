import json
from langchain_postgres import PGVector
from app.services.ollama import BGEM3_EMBEDDINGS
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