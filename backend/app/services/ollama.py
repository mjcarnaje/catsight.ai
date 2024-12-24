from langchain_ollama import ChatOllama, OllamaEmbeddings, OllamaLLM

base_url = "http://ollama:11434"

EMBEDDING_MODEL = OllamaEmbeddings(model="bge-m3", base_url=base_url)

CHAT_LLM = ChatOllama(model="tinyllama", base_url=base_url, temperature=0)
