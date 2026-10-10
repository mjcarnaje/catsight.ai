"""An organization's AI provider: where its models run, and proof that they work.

Organization admins only. An organization brings its own key (OpenRouter or
OpenAI) or, when the super admin allows it, runs on this server's Ollama. The key
is write-only: it is encrypted at rest and never returned, logged or echoed back.
Saving first proves the configuration with one embedding and one tiny chat call,
so a bad key or model is refused before anything is stored. Changing the embedding
model re-embeds every document with the organization's own key, so it needs an
explicit confirmation.
"""
import logging
from dataclasses import dataclass

from django.conf import settings
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from ..constant import DocumentStatus, Provider
from ..models import Document
from ..services import llm, secrets
from ..services.errors import describe_error
from ..tasks import tasks
from ..utils.permissions import IsOrgAdmin

logger = logging.getLogger(__name__)

MODEL_FIELDS = ("chat_model", "fast_model", "ocr_model", "embedding_model", "reranker_model")
MAX_MODEL_CHARS = 200
PROVIDER_LABELS = {
    Provider.OPENROUTER.value: "OpenRouter",
    Provider.OPENAI.value: "OpenAI",
    Provider.OLLAMA.value: "Ollama (this server)",
}
PROVIDER_CHOICES = ("", *PROVIDER_LABELS)
MIN_KEY_CHARS_FOR_LAST4 = 8  # a shorter key would be shown in full


class _Refusal(Exception):
    """A save that stops with an answer for the admin: `body` goes back with `http_status`."""

    def __init__(self, http_status: int, body: dict):
        super().__init__(body["detail"])
        self.http_status = http_status
        self.body = body


def _refuse(code: str, detail: str, http_status: int = status.HTTP_400_BAD_REQUEST, **extra) -> _Refusal:
    return _Refusal(http_status, {"code": code, "detail": detail, **extra})


@dataclass(frozen=True)
class _Update:
    provider: str
    api_key: str | None
    models: dict[str, str]  # only the fields the request named, stripped
    confirm_reindex: bool


def _parse(data) -> _Update:
    """The request body, validated; the submitted key is never echoed in an error."""
    if not isinstance(data, dict):
        raise ValidationError({"non_field_errors": ["Send a JSON object."]})
    provider = data.get("provider")
    if not isinstance(provider, str) or provider not in PROVIDER_CHOICES:
        raise ValidationError({"provider": ['Choose "" (AI off), openrouter, openai or ollama.']})
    api_key = data.get("api_key")
    if api_key is not None and not isinstance(api_key, str):
        raise ValidationError({"api_key": ["Must be a string."]})
    models = data.get("models", {})
    if not isinstance(models, dict):
        raise ValidationError({"models": ["Must be an object of model names."]})
    unknown = sorted(name for name in models if name not in MODEL_FIELDS)
    if unknown:
        raise ValidationError({"models": [f"Unknown model field(s): {', '.join(unknown)}."]})
    cleaned = {}
    for name, value in models.items():
        if not isinstance(value, str) or len(value.strip()) > MAX_MODEL_CHARS:
            raise ValidationError({name: [f"Must be a model name of at most {MAX_MODEL_CHARS} characters."]})
        cleaned[name] = value.strip()
    confirm = data.get("confirm_reindex")
    if confirm is not None and not isinstance(confirm, bool):
        raise ValidationError({"confirm_reindex": ["Must be true or false."]})
    return _Update(provider, api_key, cleaned, bool(confirm))


def _saved_models(organization) -> dict[str, str]:
    return {field: getattr(organization, field) for field in MODEL_FIELDS}


def _stale_documents(organization, signature: str):
    """Ready documents whose vectors came from an embedding model other than `signature`."""
    return Document.objects.filter(
        organization=organization, status=DocumentStatus.READY.value, is_failed=False, chunk_count__gt=0,
    ).exclude(embedding_model=signature)


def _providers(organization) -> list[dict]:
    return [
        {
            "value": provider.value,
            "label": PROVIDER_LABELS[provider.value],
            "needs_key": provider is not Provider.OLLAMA,
            "available": provider is not Provider.OLLAMA or organization.ollama_allowed,
        }
        for provider in Provider
    ]


def _payload(organization) -> dict:
    models = _saved_models(organization)
    effective, documents_to_reindex = None, 0
    if organization.ai_provider:
        cfg = llm.build_settings(organization.ai_provider, "", **models)
        effective = {field: getattr(cfg, field) for field in MODEL_FIELDS}
        documents_to_reindex = _stale_documents(organization, cfg.embedding_signature).count()
    return {
        "provider": organization.ai_provider,
        "has_key": bool(organization.ai_api_key),
        "key_last4": organization.ai_api_key_last4,
        "models": models,
        "effective": effective,
        "defaults": {provider.value: llm.defaults_for(provider.value) for provider in Provider},
        "providers": _providers(organization),
        "embedding_dimensions": settings.EMBEDDING_DIMENSIONS,
        "documents_to_reindex": documents_to_reindex,
    }


def _key_for(organization, update: _Update) -> str:
    """The key to check and store: the new one, or the saved one while the provider is unchanged."""
    new_key = (update.api_key or "").strip()
    if new_key:
        return new_key
    if update.provider == organization.ai_provider and organization.ai_api_key:
        try:
            return secrets.decrypt(organization.ai_api_key)
        except secrets.SecretUnavailable as e:
            raise _refuse("key_required", str(e)) from e
    # Switching providers always needs a new key: an OpenRouter key doesn't work at OpenAI.
    raise _refuse("key_required", f"Enter an API key for {PROVIDER_LABELS[update.provider]}.")


def _redact(message: str, key: str) -> str:
    """`message` without `key`, in case a provider's error echoes the key back."""
    return message.replace(key, "[redacted]") if key else message


def _check(organization, cfg: llm.ModelSettings) -> None:
    try:
        llm.check(cfg)
    except Exception as e:
        logger.warning("AI provider check failed for organization %s", organization.id, exc_info=True)
        raise _refuse("check_failed", f"The provider check failed: {_redact(describe_error(e), cfg.api_key)}") from e


def _last4(key: str) -> str:
    return key[-4:] if len(key) >= MIN_KEY_CHARS_FOR_LAST4 else ""


def _store(organization, provider: str, key: str, models: dict[str, str]) -> None:
    organization.ai_provider = provider
    organization.ai_api_key = secrets.encrypt(key) if key else ""
    organization.ai_api_key_last4 = _last4(key)
    for field, value in models.items():
        setattr(organization, field, value)
    organization.save(update_fields=["ai_provider", "ai_api_key", "ai_api_key_last4", *MODEL_FIELDS, "updated_at"])


def _save(organization, update: _Update) -> int:
    """Validate, prove and store the configuration; returns how many documents were re-queued."""
    models = {field: update.models.get(field, getattr(organization, field)) for field in MODEL_FIELDS}
    if not update.provider:
        _store(organization, "", "", models)
        return 0

    if update.provider == Provider.OLLAMA.value:
        if not organization.ollama_allowed:
            raise _refuse("ollama_not_allowed", "This server's local models aren't enabled for your organization.")
        key = ""  # always this server's Ollama, never a URL from the request
    else:
        key = _key_for(organization, update)

    try:
        cfg = llm.build_settings(update.provider, key, **models)
    except llm.AINotConfigured as e:
        raise _refuse("ai_not_configured", str(e)) from e

    # Asked before the check, so confirming doesn't pay for the provider calls twice
    documents = list(_stale_documents(organization, cfg.embedding_signature))
    if documents and not update.confirm_reindex:
        raise _refuse(
            "reindex_required",
            f"Changing the embedding model re-embeds {len(documents)} documents with this provider. "
            "Confirm to continue.",
            status.HTTP_409_CONFLICT,
            documents=len(documents),
        )
    _check(organization, cfg)

    _store(organization, update.provider, key, models)
    for document in documents:
        tasks.reprocess(document, DocumentStatus.INDEXING)
    return len(documents)


@api_view(["GET", "PUT"])
@permission_classes([IsOrgAdmin])
def ai_settings(request):
    organization = request.organization
    if request.method == "GET":
        return Response(_payload(organization))
    try:
        reindexing = _save(organization, _parse(request.data))
    except _Refusal as refusal:
        return Response(refusal.body, status=refusal.http_status)
    payload = _payload(organization)
    if reindexing:
        payload["reindexing"] = reindexing
    return Response(payload)
