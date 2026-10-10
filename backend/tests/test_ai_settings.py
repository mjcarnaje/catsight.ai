"""The organization's AI provider: admins only, keys write-only, saves proven before stored.

Every test that saves replaces the provider check with a recording fake (`checks`):
the real check would call a model, and the autouse fixture makes unfaked calls fail.
"""
import pytest
from django.conf import settings

from app.constant import DocumentStatus, OrgRole
from app.models import Document
from app.services import llm, secrets

from .conftest import configure_ai, make_org, make_user

URL = "/api/organization/ai/"


@pytest.fixture
def checks(monkeypatch):
    """Every provider check is recorded instead of calling a model, and passes."""
    calls = []
    monkeypatch.setattr(llm, "check", lambda cfg: calls.append(cfg))
    return calls


def ready_document(organization, uploader, embedding_model="openrouter:baai/bge-m3", **extra):
    fields = {"status": DocumentStatus.READY.value, "chunk_count": 1, **extra}
    return Document.objects.create(
        organization=organization, embedding_model=embedding_model, file="x.pdf", uploaded_by=uploader, **fields,
    )


# --- Reading ---------------------------------------------------------------------------------
@pytest.mark.django_db
def test_admin_reads_the_provider_and_never_the_key(api, admin, org):
    response = api(admin, org).get(URL)
    assert response.status_code == 200
    body = response.json()
    assert body["provider"] == "openrouter" and body["has_key"] is True and body["key_last4"] == "1234"
    assert body["models"]["reranker_model"] == "none"
    assert body["effective"]["chat_model"] == settings.PROVIDER_DEFAULTS["openrouter"]["chat_model"]
    assert body["effective"]["reranker_model"] == ""
    assert [p["value"] for p in body["providers"]] == ["openrouter", "openai", "ollama"]
    assert [p["available"] for p in body["providers"]] == [True, True, False]
    assert body["embedding_dimensions"] == settings.EMBEDDING_DIMENSIONS
    assert body["documents_to_reindex"] == 0
    assert b"sk-test" not in response.content


@pytest.mark.django_db
def test_the_page_counts_only_ready_documents_embedded_another_way(api, admin, org):
    ready_document(org, admin, embedding_model="openrouter:old/model")
    ready_document(org, admin, embedding_model="openrouter:old/model", is_failed=True)
    ready_document(org, admin, embedding_model="openrouter:old/model", chunk_count=0)
    ready_document(org, admin, embedding_model="openrouter:baai/bge-m3")
    response = api(admin, org).get(URL)
    assert response.json()["documents_to_reindex"] == 1


@pytest.mark.django_db
def test_only_organization_admins_read_or_change_the_provider(api, member, guest, org, checks):
    for user in (member, guest):
        client = api(user, org)
        assert client.get(URL).status_code == 403
        assert client.put(URL, {"provider": ""}, format="json").status_code == 403
    org.refresh_from_db()
    assert org.ai_provider == "openrouter" and not checks


# --- Saving the provider and its key ---------------------------------------------------------
@pytest.mark.django_db
def test_switching_provider_stores_the_new_key_encrypted(api, admin, org, checks):
    response = api(admin, org).put(
        URL,
        {"provider": "openai", "api_key": "  sk-new-key-5678  ", "models": {"chat_model": "gpt-4.1"}},
        format="json",
    )
    assert response.status_code == 200
    body = response.json()
    assert body["provider"] == "openai" and body["has_key"] is True and body["key_last4"] == "5678"
    assert b"sk-new-key" not in response.content

    org.refresh_from_db()
    assert org.ai_provider == "openai" and org.chat_model == "gpt-4.1"
    assert secrets.decrypt(org.ai_api_key) == "sk-new-key-5678"
    assert len(checks) == 1
    assert checks[0].provider == "openai" and checks[0].api_key == "sk-new-key-5678"
    assert checks[0].base_url == settings.OPENAI_BASE_URL


@pytest.mark.django_db
def test_switching_provider_needs_a_new_key(api, admin, org, checks):
    response = api(admin, org).put(URL, {"provider": "openai"}, format="json")
    assert response.status_code == 400
    assert response.json() == {"code": "key_required", "detail": "Enter an API key for OpenAI."}
    org.refresh_from_db()
    assert org.ai_provider == "openrouter" and secrets.decrypt(org.ai_api_key) == "sk-test-key-1234"
    assert not checks


@pytest.mark.django_db
def test_the_same_provider_without_a_key_keeps_the_saved_key(api, admin, org, checks):
    response = api(admin, org).put(URL, {"provider": "openrouter", "models": {"chat_model": "acme/chat"}}, format="json")
    assert response.status_code == 200
    assert checks[0].api_key == "sk-test-key-1234"
    org.refresh_from_db()
    assert secrets.decrypt(org.ai_api_key) == "sk-test-key-1234" and org.chat_model == "acme/chat"


@pytest.mark.django_db
def test_short_keys_are_never_shown_in_full(api, admin, org, checks):
    response = api(admin, org).put(URL, {"provider": "openai", "api_key": "abc"}, format="json")
    assert response.status_code == 200
    assert response.json()["has_key"] is True and response.json()["key_last4"] == ""
    assert checks[0].api_key == "abc"


# --- Proving the configuration before storing it ----------------------------------------------
@pytest.mark.django_db
def test_a_failing_check_saves_nothing(api, admin, org, monkeypatch):
    def reject(cfg):
        raise ValueError(
            "text-embedding-ada-002 returns 1536-dimensional vectors; this server stores 1024. "
            "Choose an embedding model that returns 1024."
        )

    monkeypatch.setattr(llm, "check", reject)
    response = api(admin, org).put(
        URL,
        {"provider": "openai", "api_key": "sk-bad-key-9999", "models": {"embedding_model": "text-embedding-ada-002"}},
        format="json",
    )
    assert response.status_code == 400
    assert response.json()["code"] == "check_failed"
    assert response.json()["detail"].startswith("The provider check failed: text-embedding-ada-002 returns 1536")
    assert b"sk-bad-key" not in response.content
    org.refresh_from_db()
    assert org.ai_provider == "openrouter" and org.embedding_model == ""
    assert secrets.decrypt(org.ai_api_key) == "sk-test-key-1234"


@pytest.mark.django_db
def test_a_provider_error_never_echoes_the_key(api, admin, org, monkeypatch):
    def echo(cfg):
        raise ValueError(f"Invalid API key: {cfg.api_key}")

    monkeypatch.setattr(llm, "check", echo)
    response = api(admin, org).put(URL, {"provider": "openai", "api_key": "sk-echo-7777"}, format="json")
    assert response.status_code == 400 and response.json()["code"] == "check_failed"
    assert "[redacted]" in response.json()["detail"]
    assert b"sk-echo-7777" not in response.content


@pytest.mark.django_db
@pytest.mark.parametrize(
    "body, field",
    [
        ({"provider": "anthropic"}, "provider"),
        ({}, "provider"),
        ({"provider": "openai", "api_key": 1234}, "api_key"),
        ({"provider": "openrouter", "models": {"base_url": "https://evil.example"}}, "models"),
        ({"provider": "openrouter", "models": {"chat_model": "a" * 201}}, "chat_model"),
    ],
)
def test_invalid_bodies_are_refused_before_any_check(api, admin, org, checks, body, field):
    response = api(admin, org).put(URL, body, format="json")
    assert response.status_code == 400 and field in response.json()
    assert not checks
    org.refresh_from_db()
    assert org.ai_provider == "openrouter"


# --- Re-embedding -----------------------------------------------------------------------------
@pytest.mark.django_db
def test_changing_the_embedding_model_needs_confirmation(api, admin, org, checks, offline):
    first = ready_document(org, admin)
    second = ready_document(org, admin)
    client = api(admin, org)
    assert client.get(URL).json()["documents_to_reindex"] == 0

    change = {"provider": "openrouter", "models": {"embedding_model": "openai/text-embedding-3-small"}}
    response = client.put(URL, change, format="json")
    assert response.status_code == 409
    assert response.json() == {
        "code": "reindex_required",
        "documents": 2,
        "detail": "Changing the embedding model re-embeds 2 documents with this provider. Confirm to continue.",
    }
    org.refresh_from_db()
    assert org.embedding_model == "" and not offline
    assert checks == []  # asking first costs no provider calls

    response = client.put(URL, {**change, "confirm_reindex": True}, format="json")
    assert response.status_code == 200
    assert response.json()["reindexing"] == 2
    assert len(checks) == 1
    assert sorted(offline) == sorted([first.id, second.id])
    for document in (first, second):
        document.refresh_from_db()
        assert document.status == DocumentStatus.INDEXING.value
    org.refresh_from_db()
    assert org.embedding_model == "openai/text-embedding-3-small"


@pytest.mark.django_db
def test_changing_only_the_chat_model_needs_no_confirmation(api, admin, org, checks, offline):
    ready_document(org, admin)
    response = api(admin, org).put(
        URL, {"provider": "openrouter", "models": {"chat_model": "qwen/qwen3-30b-a3b"}}, format="json",
    )
    assert response.status_code == 200
    assert "reindexing" not in response.json()
    assert offline == []
    org.refresh_from_db()
    assert org.chat_model == "qwen/qwen3-30b-a3b"


# --- This server's Ollama ---------------------------------------------------------------------
@pytest.mark.django_db
def test_ollama_must_be_allowed_by_the_super_admin(api, admin, org, checks):
    response = api(admin, org).put(URL, {"provider": "ollama"}, format="json")
    assert response.status_code == 400 and response.json()["code"] == "ollama_not_allowed"
    org.refresh_from_db()
    assert org.ai_provider == "openrouter" and not checks


@pytest.mark.django_db
def test_allowed_ollama_runs_on_this_server_without_a_key(api, admin, org, checks):
    org.ollama_allowed = True
    org.save()
    response = api(admin, org).put(
        URL, {"provider": "ollama", "api_key": "sk-leftover-0000", "base_url": "https://evil.example"}, format="json",
    )
    assert response.status_code == 200
    assert response.json()["has_key"] is False
    org.refresh_from_db()
    assert org.ai_provider == "ollama" and org.ai_api_key == ""
    assert checks[0].base_url == settings.OLLAMA_BASE_URL and checks[0].api_key == ""


# --- Turning AI off ---------------------------------------------------------------------------
@pytest.mark.django_db
def test_turning_ai_off_clears_the_key_and_keeps_the_model_names(api, admin, org, checks):
    org.chat_model = "custom/chat"
    org.save()
    response = api(admin, org).put(URL, {"provider": ""}, format="json")
    assert response.status_code == 200
    assert response.json()["provider"] == "" and response.json()["has_key"] is False
    assert response.json()["effective"] is None
    assert not checks
    org.refresh_from_db()
    assert (org.ai_provider, org.ai_api_key, org.ai_api_key_last4) == ("", "", "")
    assert org.chat_model == "custom/chat"
    assert api(admin, org).get("/api/config/").json()["organization"]["ai_configured"] is False


# --- Isolation --------------------------------------------------------------------------------
@pytest.mark.django_db
def test_an_admin_of_one_organization_cannot_change_another(api, admin, org, checks):
    globex = configure_ai(make_org("Globex", "globex", configured=False), "openai", "sk-globex-9999")
    rival = make_user("rival@globex.com", globex, OrgRole.ADMIN.value)

    response = api(admin, "globex").put(URL, {"provider": ""}, format="json")
    assert response.status_code == 403 and response.json()["code"] == "not_a_member"
    assert api(admin, "globex").get(URL).status_code == 403

    assert api(admin, org).put(URL, {"provider": "openai", "api_key": "sk-acme-0001"}, format="json").status_code == 200
    globex.refresh_from_db()
    assert globex.ai_provider == "openai" and secrets.decrypt(globex.ai_api_key) == "sk-globex-9999"
    assert api(rival, globex).get(URL).json()["key_last4"] == "9999"
