from langchain_postgres import PGVectorStore, PGEngine
from langchain_ollama import OllamaEmbeddings

DB_URI = "postgresql+psycopg://postgres:postgres@db:5432/app_db"
DBNAME = "app_db"
DBUSER = "postgres"
DBPASSWORD = "postgres"
DBHOST = "db"
DBPORT = 5432

CONNECTION_STRING = f"postgresql+psycopg3://{DBUSER}:{DBPASSWORD}@{DBHOST}:{DBPORT}/{DBNAME}"
engine = PGEngine.from_connection_string(url=CONNECTION_STRING)

EMBEDDING_MODEL_ID = "mxbai-embed-large"
TABLE_NAME = "docs_chunks"
VECTOR_SIZE = 1024

embedding = OllamaEmbeddings(model=EMBEDDING_MODEL_ID, base_url="http://ollama:11434")

engine.init_vectorstore_table(
    table_name=TABLE_NAME,
    vector_size=VECTOR_SIZE,
)

vector_store = PGVectorStore.create_sync(
    engine=engine,
    table_name=TABLE_NAME,
    embedding_service=embedding,
)

retriever = vector_store.as_retriever(
    search_type="similarity_score_threshold",
    search_kwargs={"score_threshold": 0.4},
)