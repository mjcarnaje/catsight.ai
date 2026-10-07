"""Shared Ollama clients.

Every chat model and embedding in the app is built here so the endpoint,
context window and "thinking" behaviour stay consistent. Model tags come from
settings (CHAT_MODEL / FAST_MODEL / EMBEDDING_MODEL).
"""
import logging
from typing import Optional

import httpx
from django.conf import settings
from langchain_ollama import ChatOllama, OllamaEmbeddings

logger = logging.getLogger(__name__)

base_url = settings.OLLAMA_BASE_URL

# Context window for short jobs (chat titles, "is this a question?"). Keeping it
# small keeps the fast model's memory low next to the chat model.
FAST_NUM_CTX = 2048

_reasoning_by_model: dict[str, Optional[bool]] = {}


def _reasoning_for(model: str) -> Optional[bool]:
    """Pick langchain-ollama's `reasoning` setting from what the model supports.

    - No thinking support -> None (send nothing).
    - Thinking-only models (e.g. Qwen3 "Thinking-2507", which `qwen3:4b` now
      points to) can't stop thinking: asked to, their reasoning leaks into the
      answer. Keep thinking on so Ollama returns it separately (True).
    - Hybrid models (e.g. qwen3:1.7b) can skip thinking -> False, much faster on CPU.
    """
    if model in _reasoning_by_model:
        return _reasoning_by_model[model]
    try:
        info = httpx.post(f"{base_url}/api/show", json={"model": model}, timeout=10).json()
    except httpx.HTTPError as e:
        logger.warning(f"Couldn't ask Ollama about {model} ({e}); leaving thinking at its default")
        return None  # not cached, so it's retried once Ollama is reachable
    if "error" in info:
        return None  # model not pulled yet; not cached
    finetune = str(info.get("model_info", {}).get("general.finetune") or "").lower()
    if "thinking" not in info.get("capabilities", []):
        reasoning = None
    elif "thinking" in finetune:
        reasoning = True
    else:
        reasoning = False
    _reasoning_by_model[model] = reasoning
    logger.info(f"{model}: reasoning={reasoning} (finetune={finetune or 'n/a'})")
    return reasoning


# Deliberately not cached: ChatOllama holds an async HTTP client bound to the event
# loop it was first used on, and the summarizer runs a fresh loop per document.
# Construction is cheap.
def get_chat_model(
    model: Optional[str] = None,
    temperature: float = 0.0,
    num_ctx: Optional[int] = None,
) -> ChatOllama:
    """Return a ChatOllama for `model`, defaulting to settings.CHAT_MODEL."""
    model = model or settings.CHAT_MODEL
    return ChatOllama(
        model=model,
        base_url=base_url,
        temperature=temperature,
        num_ctx=num_ctx or settings.OLLAMA_NUM_CTX,
        reasoning=_reasoning_for(model),
    )


def get_embeddings(model: Optional[str] = None) -> OllamaEmbeddings:
    """Return an embeddings client, defaulting to settings.EMBEDDING_MODEL."""
    return OllamaEmbeddings(model=model or settings.EMBEDDING_MODEL, base_url=base_url)
