from langchain_postgres import PGVector
from app.services.ollama import OLLAMA_EMBEDDINGS

vector_store = PGVector(
    embeddings=OLLAMA_EMBEDDINGS,
    collection_name="docs_chunks",
    connection="postgresql+psycopg://postgres:postgres@db:5432/app_db",
    use_jsonb=True,
)