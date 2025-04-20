from langchain_ollama import ChatOllama, OllamaEmbeddings, OllamaLLM

EMBEDDING_MODEL_ID = "bge-m3"
CHAT_MODELS = ["llama3.2:1b", "deepseek-r1:1.5b"]

base_url = "http://ollama:11434"

OLLAMA_EMBEDDINGS = OllamaEmbeddings(model=EMBEDDING_MODEL_ID, base_url=base_url)

OLLAMA_CHAT = ChatOllama(model=CHAT_MODELS[0], base_url=base_url, temperature=0)
