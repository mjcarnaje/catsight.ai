from langchain_postgres import PGVector
from app.services.ollama import OLLAMA_EMBEDDINGS
# import psycopg
# from langchain_postgres import PostgresChatMessageHistory

conn_info = "postgresql+psycopg://postgres:postgres@db:5432/app_db"

vector_store = PGVector(
    embeddings=OLLAMA_EMBEDDINGS,
    collection_name="docs_chunks",
    connection=conn_info,
    use_jsonb=True,
)

retriever = vector_store.as_retriever()

# sync_connection = psycopg.connect(conn_info)

# table_name = "chat_history"
# PostgresChatMessageHistory.create_tables(sync_connection, table_name)