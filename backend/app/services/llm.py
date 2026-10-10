"""One place that builds every model client the app uses.

Each organization brings its own provider (Organization.ai_provider):
- "openrouter": OpenRouter's OpenAI-compatible API, with the organization's key
- "openai":     OpenAI's API, with the organization's key
- "ollama":     this server's Ollama (no key; enabled per organization by the super admin)

`settings_for(organization)` resolves that into a ModelSettings (decrypted key,
provider defaults for blank model names). Every function here takes one, so a
call can never run on another organization's key. Callers ask for a role
("chat", "fast", "ocr", embeddings) instead of a vendor class.
"""
from __future__ import annotations

import base64
import logging
import re
from dataclasses import dataclass
from functools import lru_cache
from typing import TYPE_CHECKING, Optional, Type, TypeVar

import httpx
from django.conf import settings
from langchain_core.embeddings import Embeddings
from langchain_core.language_models import BaseChatModel
from langchain_core.messages import HumanMessage
from pydantic import BaseModel

from ..constant import Provider
from . import secrets

if TYPE_CHECKING:
    from ..models import Organization

logger = logging.getLogger(__name__)

SchemaT = TypeVar("SchemaT", bound=BaseModel)

# Small context for short jobs (chat titles) so the local fast model stays light.
FAST_NUM_CTX = 2048
REQUEST_TIMEOUT = 120  # seconds; OCR of a dense page can take a while
# OpenAI's reasoning models (o-series, GPT-5) reject any temperature but the default
_FIXED_TEMPERATURE_RE = re.compile(r"^(openai/)?(o\d|gpt-5)", re.IGNORECASE)


class AINotConfigured(RuntimeError):
    """The organization has no usable model provider; the message is shown as-is."""



@dataclass(frozen=True)
class ModelSettings:
    """An organization's resolved provider: what every model call needs."""

    provider: str
    api_key: str  # "" for ollama
    base_url: str
    chat_model: str
    fast_model: str
    ocr_model: str
    embedding_model: str
    reranker_model: str

    def __repr__(self) -> str:  # never print the key in logs or tracebacks
        return f"ModelSettings(provider={self.provider!r}, chat_model={self.chat_model!r})"

    @property
    def embedding_signature(self) -> str:
        """Identifies the vector space: chunks embedded under another signature can't be compared."""
        return f"{self.provider}:{self.embedding_model}"

    @property
    def is_hosted(self) -> bool:
        """OpenAI-compatible hosted API (OpenRouter or OpenAI), as opposed to Ollama."""
        return self.provider in {Provider.OPENROUTER.value, Provider.OPENAI.value}

    @property
    def supports_vision_ocr(self) -> bool:
        return self.is_hosted and bool(self.ocr_model)

    @property
    def supports_rerank(self) -> bool:
        return self.provider == Provider.OPENROUTER.value and bool(self.reranker_model)


def defaults_for(provider: str) -> dict[str, str]:
    """The default model names for `provider` (settings.PROVIDER_DEFAULTS)."""
    return dict(settings.PROVIDER_DEFAULTS[provider])


def base_url_for(provider: str) -> str:
    return {
        Provider.OPENROUTER.value: settings.OPENROUTER_BASE_URL,
        Provider.OPENAI.value: settings.OPENAI_BASE_URL,
        Provider.OLLAMA.value: settings.OLLAMA_BASE_URL,
    }[provider]


TURNED_OFF = "none"  # a model name meaning "don't use this role" (reranker, OCR model)


def build_settings(provider: str, api_key: str = "", **models: str) -> ModelSettings:
    """ModelSettings for `provider`.

    A blank or missing model name takes the provider's default; "none" turns an
    optional role off (no reranking, no vision OCR).
    """
    if provider not in {p.value for p in Provider}:
        raise AINotConfigured(f"Unknown provider {provider!r}.")
    chosen = {}
    for name, default in defaults_for(provider).items():
        value = (models.get(name) or "").strip()
        if value.lower() == TURNED_OFF and name in {"reranker_model", "ocr_model"}:
            value = ""
        else:
            value = value or default
        chosen[name] = value
    return ModelSettings(provider=provider, api_key=api_key, base_url=base_url_for(provider), **chosen)


def settings_for(organization: "Organization") -> ModelSettings:
    """The organization's provider, ready to call; raises AINotConfigured if it can't be used."""
    provider = organization.ai_provider
    if not provider:
        raise AINotConfigured(
            f"{organization.name} has no AI provider yet. An organization admin can add one in Settings."
        )
    api_key = ""
    if provider == Provider.OLLAMA.value:
        if not organization.ollama_allowed:
            raise AINotConfigured("This server's local models aren't enabled for your organization.")
    else:
        if not organization.ai_api_key:
            raise AINotConfigured(
                f"{organization.name} has no API key yet. An organization admin can add one in Settings."
            )
        try:
            api_key = secrets.decrypt(organization.ai_api_key)
        except secrets.SecretUnavailable as e:
            raise AINotConfigured(str(e)) from e
    return build_settings(
        provider,
        api_key,
        chat_model=organization.chat_model,
        fast_model=organization.fast_model,
        ocr_model=organization.ocr_model,
        embedding_model=organization.embedding_model,
        reranker_model=organization.reranker_model,
    )


def _openai_kwargs(cfg: ModelSettings) -> dict:
    """Client options shared by OpenRouter and OpenAI (both OpenAI-compatible)."""
    kwargs = {"base_url": cfg.base_url, "api_key": cfg.api_key, "timeout": REQUEST_TIMEOUT, "max_retries": 2}
    if cfg.provider == Provider.OPENROUTER.value:
        # OpenRouter attributes usage to the app in its dashboard
        kwargs["default_headers"] = {"HTTP-Referer": settings.PUBLIC_URL, "X-Title": "CATSight.AI"}
    return kwargs


def accepts_temperature(cfg: ModelSettings, model: str) -> bool:
    return not (cfg.is_hosted and _FIXED_TEMPERATURE_RE.match(model))


# --- Chat models -----------------------------------------------------------------
# Not cached: async clients bind to the event loop they first ran on, and the
# summarizer runs a fresh loop per document. Construction is cheap.
def get_chat_model(
    cfg: ModelSettings,
    model: Optional[str] = None,
    temperature: float = 0.0,
    max_tokens: Optional[int] = None,
    num_ctx: Optional[int] = None,
) -> BaseChatModel:
    """A chat model for `model`, defaulting to the organization's chat model."""
    model = model or cfg.chat_model
    if cfg.is_hosted:
        from langchain_openai import ChatOpenAI

        options = {"temperature": temperature} if accepts_temperature(cfg, model) else {}
        return ChatOpenAI(model=model, max_tokens=max_tokens, **options, **_openai_kwargs(cfg))

    from langchain_ollama import ChatOllama

    return ChatOllama(
        model=model,
        base_url=cfg.base_url,
        temperature=temperature,
        num_ctx=num_ctx or settings.OLLAMA_NUM_CTX,
        num_predict=max_tokens,
        reasoning=_ollama_reasoning(cfg, model),
    )


def get_fast_model(cfg: ModelSettings, temperature: float = 0.0) -> BaseChatModel:
    """The small model for background chores (chat titles)."""
    return get_chat_model(cfg, cfg.fast_model, temperature=temperature, num_ctx=FAST_NUM_CTX)


def structured(cfg: ModelSettings, llm: BaseChatModel, schema: Type[SchemaT]):
    """`llm` constrained to return `schema`.

    Hosted models get strict JSON-schema output; Ollama's default (its own
    JSON-schema `format`) is already the most reliable mode for small local models.
    """
    if cfg.is_hosted:
        return llm.with_structured_output(schema, method="json_schema", strict=True)
    return llm.with_structured_output(schema)


# --- Embeddings ------------------------------------------------------------------
@lru_cache(maxsize=32)
def get_embeddings(cfg: ModelSettings) -> Embeddings:
    """The embeddings client; every vector it returns must have EMBEDDING_DIMENSIONS values."""
    if cfg.is_hosted:
        from langchain_openai import OpenAIEmbeddings

        kwargs = _openai_kwargs(cfg)
        return OpenAIEmbeddings(
            model=cfg.embedding_model,
            base_url=kwargs["base_url"],
            api_key=kwargs["api_key"],
            default_headers=kwargs.get("default_headers"),
            # text-embedding-3 models shorten their vectors on request; others have a fixed size
            dimensions=settings.EMBEDDING_DIMENSIONS if "text-embedding-3" in cfg.embedding_model else None,
            # Without this LangChain pre-tokenizes with tiktoken and sends token ids,
            # which only OpenAI's own API accepts. Chunks are far below the limit.
            check_embedding_ctx_length=False,
            model_kwargs={"encoding_format": "float"},
            chunk_size=64,  # texts per request
            timeout=REQUEST_TIMEOUT,
            max_retries=3,
        )

    from langchain_ollama import OllamaEmbeddings

    return OllamaEmbeddings(model=cfg.embedding_model, base_url=cfg.base_url)


def _checked(cfg: ModelSettings, vectors: list[list[float]]) -> list[list[float]]:
    expected = settings.EMBEDDING_DIMENSIONS
    for vector in vectors:
        if len(vector) != expected:
            raise ValueError(
                f"{cfg.embedding_model} returns {len(vector)}-dimensional vectors; "
                f"this server stores {expected}. Choose an embedding model that returns {expected}."
            )
    return vectors


def embed_documents(cfg: ModelSettings, texts: list[str]) -> list[list[float]]:
    return _checked(cfg, get_embeddings(cfg).embed_documents(texts))


def embed_query(cfg: ModelSettings, text: str) -> list[float]:
    return _checked(cfg, [get_embeddings(cfg).embed_query(text)])[0]


# --- Reranking -------------------------------------------------------------------
def rerank(cfg: ModelSettings, query: str, documents: list[str]) -> list[float]:
    """Relevance (0-1) of each document to `query`, in input order.

    Uses OpenRouter's Cohere-style /rerank endpoint with the organization's reranker.
    """
    if not cfg.supports_rerank:
        raise AINotConfigured("Reranking needs OpenRouter and a reranker model.")
    kwargs = _openai_kwargs(cfg)
    response = httpx.post(
        f"{cfg.base_url}/rerank",
        headers={"Authorization": f"Bearer {cfg.api_key}", **kwargs.get("default_headers", {})},
        json={"model": cfg.reranker_model, "query": query, "documents": documents},
        timeout=30,
    )
    response.raise_for_status()
    scores = [0.0] * len(documents)
    for result in response.json()["results"]:
        scores[result["index"]] = float(result.get("relevance_score", result.get("score", 0.0)))
    return scores


# --- Vision OCR ------------------------------------------------------------------
def transcribe_image(cfg: ModelSettings, image: bytes, prompt: str, mime_type: str = "image/jpeg") -> str:
    """Send one page image to the organization's OCR model and return its transcription."""
    if not cfg.supports_vision_ocr:
        raise AINotConfigured("Vision OCR needs OpenRouter or OpenAI and an OCR model.")
    data_url = f"data:{mime_type};base64,{base64.b64encode(image).decode()}"
    message = HumanMessage(content=[
        {"type": "text", "text": prompt},
        {"type": "image_url", "image_url": {"url": data_url}},
    ])
    response = get_chat_model(cfg, cfg.ocr_model, temperature=0.0).invoke([message])
    return response.content if isinstance(response.content, str) else str(response.content)


# --- Checking a configuration ------------------------------------------------------
def check(cfg: ModelSettings) -> None:
    """Make one embedding call and one tiny chat call with `cfg`; raises if either fails.

    Run when an admin saves the organization's provider: it proves the key works,
    the chat model exists and the embedding model returns EMBEDDING_DIMENSIONS values.
    The fast, OCR and reranker models are only exercised by real work.
    """
    embed_query(cfg, "CATSight connection test")
    get_chat_model(cfg, max_tokens=16).invoke([HumanMessage("Reply with the word OK.")])


# --- Ollama details ----------------------------------------------------------------
_reasoning_by_model: dict[str, Optional[bool]] = {}


def _ollama_reasoning(cfg: ModelSettings, model: str) -> Optional[bool]:
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
        info = httpx.post(f"{cfg.base_url}/api/show", json={"model": model}, timeout=10).json()
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
