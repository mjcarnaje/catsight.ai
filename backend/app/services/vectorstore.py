from langchain_postgres import PGVector
from langchain_ollama import OllamaEmbeddings

DB_URI = "postgresql+psycopg://postgres:postgres@db:5432/app_db"
DBNAME = "app_db"
DBUSER = "postgres"
DBPASSWORD = "postgres"
DBHOST = "db"
DBPORT = 5432

DB_URI = f"postgresql+psycopg://{DBUSER}:{DBPASSWORD}@{DBHOST}:{DBPORT}/{DBNAME}"

EMBEDDING_MODEL_ID = "mxbai-embed-large"
EMBEDDINGS = OllamaEmbeddings(model=EMBEDDING_MODEL_ID, base_url="http://ollama:11434")

vector_store = PGVector(
    embeddings=EMBEDDINGS,
    collection_name="docs_chunks",
    connection=DB_URI,  
    use_jsonb=True,
)


retriever = vector_store.as_retriever(
    search_type="similarity_score_threshold",
    search_kwargs={"score_threshold": 0.3},
)