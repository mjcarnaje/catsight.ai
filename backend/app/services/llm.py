"""One place that builds every model client the app uses.

LLM_PROVIDER (settings) decides where calls go:
- "openrouter": OpenAI-compatible API at OPENROUTER_BASE_URL (hosted demo)
- "ollama":     a local Ollama server (fully offline, opt-in)

Callers ask for a role ("chat", "fast", "ocr", embeddings) instead of a vendor
class, so switching providers never touches the pipeline or the agent.
"""
from __future__ import annotations

import base64
import logging
from functools import lru_cache
from typing import Optional, Type, TypeVar

import httpx
from django.conf import settings
from langchain_core.embeddings import Embeddings
from langchain_core.language_models import BaseChatModel
from langchain_core.messages import HumanMessage
from pydantic import BaseModel

logger = logging.getLogger(__name__)

SchemaT = TypeVar("SchemaT", bound=BaseModel)

# Small context for short jobs (chat titles) so the local fast model stays light.
FAST_NUM_CTX = 2048
REQUEST_TIMEOUT = 120  # seconds; OCR of a dense page can take a while


class ProviderNotConfigured(RuntimeError):
    """Raised when a model call is attempted without the provider's credentials."""


def is_openrouter() -> bool:
    return settings.LLM_PROVIDER == "openrouter"


def _openrouter_kwargs() -> dict:
    if not settings.OPENROUTER_API_KEY:
        raise ProviderNotConfigured("OPENROUTER_API_KEY is not set; add it to .env or use LLM_PROVIDER=ollama.")
    return {
        "base_url": settings.OPENROUTER_BASE_URL,
        "api_key": settings.OPENROUTER_API_KEY,
        # OpenRouter attributes usage to the app in its dashboard
        "default_headers": {"HTTP-Referer": settings.PUBLIC_URL, "X-Title": "CATSight.AI"},
        "timeout": REQUEST_TIMEOUT,
        "max_retries": 2,
    }


# --- Chat models -----------------------------------------------------------------
# Not cached: async clients bind to the event loop they first ran on, and the
# summarizer runs a fresh loop per document. Construction is cheap.
def get_chat_model(
    model: Optional[str] = None,
    temperature: float = 0.0,
    max_tokens: Optional[int] = None,
    num_ctx: Optional[int] = None,
) -> BaseChatModel:
    """A chat model for `model`, defaulting to settings.CHAT_MODEL."""
    model = model or settings.CHAT_MODEL
    if is_openrouter():
        from langchain_openai import ChatOpenAI

        return ChatOpenAI(model=model, temperature=temperature, max_tokens=max_tokens, **_openrouter_kwargs())

    from langchain_ollama import ChatOllama

    return ChatOllama(
        model=model,
        base_url=settings.OLLAMA_BASE_URL,
        temperature=temperature,
        num_ctx=num_ctx or settings.OLLAMA_NUM_CTX,
        num_predict=max_tokens,
        reasoning=_ollama_reasoning(model),
    )


def get_fast_model(temperature: float = 0.0) -> BaseChatModel:
    """The small model for background chores (chat titles)."""
    return get_chat_model(settings.FAST_MODEL, temperature=temperature, num_ctx=FAST_NUM_CTX)


def structured(llm: BaseChatModel, schema: Type[SchemaT]):
    """`llm` constrained to return `schema`.

    OpenRouter models get strict JSON-schema output; Ollama's default (its own
    JSON-schema `format`) is already the most reliable mode for small local models.
    """
    if is_openrouter():
        return llm.with_structured_output(schema, method="json_schema", strict=True)
    return llm.with_structured_output(schema)


# --- Embeddings ------------------------------------------------------------------
@lru_cache(maxsize=1)
def get_embeddings() -> Embeddings:
    """The embeddings client; every vector it returns has EMBEDDING_DIMENSIONS values."""
    if is_openrouter():
        from langchain_openai import OpenAIEmbeddings

        kwargs = _openrouter_kwargs()
        return OpenAIEmbeddings(
            model=settings.EMBEDDING_MODEL,
            base_url=kwargs["base_url"],
            api_key=kwargs["api_key"],
            default_headers=kwargs["default_headers"],
            # Without this LangChain pre-tokenizes with tiktoken and sends token ids,
            # which only OpenAI's own API accepts. Chunks are far below the limit.
            check_embedding_ctx_length=False,
            model_kwargs={"encoding_format": "float"},
            chunk_size=64,  # texts per request
            timeout=REQUEST_TIMEOUT,
            max_retries=3,
        )

    from langchain_ollama import OllamaEmbeddings

    return OllamaEmbeddings(model=settings.EMBEDDING_MODEL, base_url=settings.OLLAMA_BASE_URL)


def _checked(vectors: list[list[float]]) -> list[list[float]]:
    expected = settings.EMBEDDING_DIMENSIONS
    for vector in vectors:
        if len(vector) != expected:
            raise ValueError(
                f"{settings.EMBEDDING_MODEL} returned {len(vector)}-dimensional vectors but "
                f"EMBEDDING_DIMENSIONS={expected}; set it to match and reindex."
            )
    return vectors


def embed_documents(texts: list[str]) -> list[list[float]]:
    return _checked(get_embeddings().embed_documents(texts))


def embed_query(text: str) -> list[float]:
    return _checked([get_embeddings().embed_query(text)])[0]


# --- Reranking -------------------------------------------------------------------
def rerank(query: str, documents: list[str]) -> list[float]:
    """Relevance (0-1) of each document to `query`, in input order.

    Uses OpenRouter's Cohere-style /rerank endpoint with RERANKER_MODEL.
    """
    if not is_openrouter() or not settings.RERANKER_MODEL:
        raise ProviderNotConfigured("Reranking needs LLM_PROVIDER=openrouter and RERANKER_MODEL.")
    kwargs = _openrouter_kwargs()
    response = httpx.post(
        f"{kwargs['base_url']}/rerank",
        headers={"Authorization": f"Bearer {kwargs['api_key']}", **kwargs["default_headers"]},
        json={"model": settings.RERANKER_MODEL, "query": query, "documents": documents},
        timeout=30,
    )
    response.raise_for_status()
    scores = [0.0] * len(documents)
    for result in response.json()["results"]:
        scores[result["index"]] = float(result.get("relevance_score", result.get("score", 0.0)))
    return scores


# --- Vision OCR ------------------------------------------------------------------
def transcribe_image(image: bytes, prompt: str, mime_type: str = "image/jpeg") -> str:
    """Send one page image to OCR_MODEL and return its transcription."""
    if not is_openrouter() or not settings.OCR_MODEL:
        raise ProviderNotConfigured("Vision OCR needs LLM_PROVIDER=openrouter and OCR_MODEL.")
    data_url = f"data:{mime_type};base64,{base64.b64encode(image).decode()}"
    message = HumanMessage(content=[
        {"type": "text", "text": prompt},
        {"type": "image_url", "image_url": {"url": data_url}},
    ])
    response = get_chat_model(settings.OCR_MODEL, temperature=0.0).invoke([message])
    return response.content if isinstance(response.content, str) else str(response.content)


# --- Ollama details ----------------------------------------------------------------
_reasoning_by_model: dict[str, Optional[bool]] = {}


def _ollama_reasoning(model: str) -> Optional[bool]:
    """langchain-ollama's `reasoning` setting for what the model supports.

    - No thinking support -> None (send nothing).
    - Thinking-only models (e.g. Qwen3 "Thinking-2507") can't stop thinking: asked
      to, their reasoning leaks into the answer, so keep it on (True) and Ollama
      returns it separately.
    - Hybrid models (e.g. qwen3:1.7b) can skip thinking -> False, much faster on CPU.
    """
    if model in _reasoning_by_model:
        return _reasoning_by_model[model]
    try:
        info = httpx.post(f"{settings.OLLAMA_BASE_URL}/api/show", json={"model": model}, timeout=10).json()
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
    return reasoning
