from langchain_ollama import ChatOllama, OllamaEmbeddings, OllamaLLM

EMBEDDING_MODEL = OllamaEmbeddings(model="bge-m3", base_url="http://ollama:11434")
LLM = OllamaLLM(model="llama3.2", base_url="http://ollama:11434", temperature=0.5)
CHAT_LLM = ChatOllama(model="llama3.2", base_url="http://ollama:11434", temperature=0.5)
