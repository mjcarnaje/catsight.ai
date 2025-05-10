from langchain_ollama import ChatOllama, OllamaEmbeddings, ChatOllama

EMBEDDING_MODEL_ID = "bge-m3"
base_url = "http://ollama:11434"

BGEM3_EMBEDDINGS = OllamaEmbeddings(model=EMBEDDING_MODEL_ID, base_url=base_url)

LLAMA_CHAT = ChatOllama(model="llama3.2:1b", base_url=base_url, temperature=0)
QWEN_CHAT = ChatOllama(model="qwen3:0.7b", base_url=base_url, temperature=0)
HERMES_CHAT = ChatOllama(model="hermes3:3b", base_url=base_url, temperature=0)

# --- Model Registry --------------------------------------------------------
# Supported models
MODELS = {
    "llama3.2:1b": LLAMA_CHAT,
    "qwen3:1.7b": QWEN_CHAT,
    "hermes3:3b": HERMES_CHAT,
}
