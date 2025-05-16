from langchain_ollama import ChatOllama

base_url = "http://ollama:11434"

LLAMA_CHAT = ChatOllama(model="llama3.2:1b", base_url=base_url, temperature=0)
QWEN_CHAT = ChatOllama(model="qwen3:0.7b", base_url=base_url, temperature=0)
HERMES_CHAT = ChatOllama(model="hermes3:3b", base_url=base_url, temperature=0)