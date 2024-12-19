from langchain_ollama import ChatOllama, OllamaEmbeddings

EMBEDDING_MODEL = OllamaEmbeddings(model="bge-m3", base_url="http://ollama:11434")
LLM = ChatOllama(model="llama3.2", base_url="http://ollama:11434")
