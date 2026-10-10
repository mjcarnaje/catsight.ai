"""Organizations are isolated: nothing of one is listed, searched, cited or changed from another.

Both organizations below hold a document with the same distinctive text and a tag
with the same name, so any missing organization filter shows up as a leak.
"""
import hashlib
from types import SimpleNamespace

import pytest
from langchain_core.messages import AIMessage

from app.constant import DocumentStatus, OrgRole
from app.models import Chat, Document, Membership, Tag
from app.services import agent, indexing, llm, organizations, search, secrets
from app.services.extraction import Page, join_pages
from app.tasks import tasks

from .conftest import make_org, make_user, membership
from .test_chat import ask, events, script, search_call  # noqa: F401  (script is a fixture)

SECRET = "zamboanga quarterly procurement ledger"


def ready(org, user, title, text, cfg=None, tags=(), year=2022):
    document = Document.objects.create(
        organization=org, title=title, year=year, uploaded_by=user, status=DocumentStatus.READY.value,
        file="x.pdf", page_count=1,
    )
    document.tags.set(tags)
    document.chunk_count = indexing.index_document(document, join_pages([Page(1, text)]), cfg or llm.settings_for(org))
    document.save()
    return document


@pytest.fixture
def two_orgs(org, admin, member):
    globex = make_org("Globex", "globex")
    rival = make_user("rival@globex.com", globex, OrgRole.ADMIN.value)
    acme_tag = Tag.objects.create(organization=org, name="Procurement")
    globex_tag = Tag.objects.create(organization=globex, name="Procurement")
    mine = ready(org, admin, "Acme ledger", f"Acme {SECRET}", tags=[acme_tag])
    theirs = ready(globex, rival, "Globex ledger", f"Globex {SECRET}", tags=[globex_tag])
    return SimpleNamespace(
        acme=org, globex=globex, rival=rival, acme_tag=acme_tag, globex_tag=globex_tag, mine=mine, theirs=theirs
    )


# --- Resolving the organization -------------------------------------------------------------
@pytest.mark.django_db
def test_a_header_naming_another_organization_is_refused(api, member, two_orgs):
    for slug in ("globex", "no-such-org"):
        response = api(member, slug).get("/api/documents/")
        assert response.status_code == 403 and response.json()["code"] == "not_a_member", slug


@pytest.mark.django_db
def test_users_in_no_organization_are_told_so(api, super_admin):
    response = api(super_admin).get("/api/documents/")
    assert response.status_code == 403 and response.json()["code"] == "no_organization"
    config = api(super_admin).get("/api/config/").json()
    assert config["organization"] is None and config["uploads_enabled"] is False


@pytest.mark.django_db
def test_without_a_header_the_oldest_membership_is_used(api, two_orgs):
    both = make_user("both@example.com", two_orgs.acme)
    Membership.objects.create(user=both, organization=two_orgs.globex, role=OrgRole.MEMBER.value)
    assert api(both).get("/api/config/").json()["organization"]["slug"] == "acme"
    assert api(both, "globex").get("/api/config/").json()["organization"]["slug"] == "globex"
    ids = [d["id"] for d in api(both, "globex").get("/api/documents/").json()["results"]]
    assert ids == [two_orgs.theirs.id]


# --- Documents -------------------------------------------------------------------------------
@pytest.mark.django_db
def test_document_lists_and_details_stay_inside_the_organization(api, admin, member, two_orgs):
    assert [d["id"] for d in api(member).get("/api/documents/").json()["results"]] == [two_orgs.mine.id]
    theirs = two_orgs.theirs.id
    for path in (f"/api/documents/{theirs}/", f"/api/documents/{theirs}/text/", f"/api/documents/{theirs}/chunks/"):
        assert api(admin).get(path).status_code == 404, path
    client = api(admin)  # even an admin of Acme can't touch Globex's documents
    assert client.patch(f"/api/documents/{theirs}/", {"title": "Mine now"}, format="json").status_code == 404
    assert client.post(f"/api/documents/{theirs}/reprocess/").status_code == 404
    assert client.put(f"/api/documents/{theirs}/text/", {"markdown": "x"}, format="json").status_code == 404
    assert client.delete(f"/api/documents/{theirs}/").status_code == 404
    assert Document.objects.get(pk=theirs).title == "Globex ledger"


@pytest.mark.django_db
def test_documents_cannot_be_tagged_with_another_organizations_tag(api, admin, two_orgs):
    url = f"/api/documents/{two_orgs.mine.id}/"
    assert api(admin).patch(url, {"tag_ids": [two_orgs.globex_tag.id]}, format="json").status_code == 400
    response = api(admin).patch(url, {"tag_ids": [two_orgs.acme_tag.id]}, format="json")
    assert response.status_code == 200 and [t["id"] for t in response.json()["tags"]] == [two_orgs.acme_tag.id]


@pytest.mark.django_db
def test_the_same_pdf_can_be_in_two_organizations(api, admin, two_orgs):
    from django.core.files.uploadedfile import SimpleUploadedFile

    from .conftest import pdf_bytes

    content = pdf_bytes(seed="shared")
    Document.objects.filter(pk=two_orgs.theirs.pk).update(file_hash=hashlib.sha256(content).hexdigest())
    upload = SimpleUploadedFile("shared.pdf", content, content_type="application/pdf")
    result = api(admin).post("/api/documents/", {"files": [upload]}, format="multipart").json()["results"][0]
    assert result["status"] == "queued"  # Globex's copy is not a duplicate for Acme
    assert Document.objects.get(pk=result["document_id"]).organization == two_orgs.acme


# --- Search, answers and the agent -----------------------------------------------------------
@pytest.mark.django_db
def test_search_never_returns_another_organizations_passages(api, member, two_orgs, cfg):
    results = api(member).get("/api/search/", {"q": SECRET}).json()["results"]
    assert [r["document"]["id"] for r in results] == [two_orgs.mine.id]
    # Another organization's tag or document ids narrow to nothing, never widen
    assert api(member).get("/api/search/", {"q": SECRET, "tags": str(two_orgs.globex_tag.id)}).json()["results"] == []
    assert search.search(SECRET, membership(member), cfg, document_ids=[two_orgs.theirs.id]) == []


@pytest.mark.django_db
def test_search_answers_cite_only_the_organizations_documents(api, member, two_orgs, monkeypatch):
    prompts = []

    class Model:
        def invoke(self, messages):
            prompts.append(messages[0].content)
            return AIMessage("The Acme ledger [1].")

    monkeypatch.setattr(llm, "get_chat_model", lambda *a, **k: Model())
    body = api(member).post("/api/search/answer/", {"q": f"What is in the {SECRET}?"}, format="json").json()
    assert [c["document_id"] for c in body["citations"]] == [two_orgs.mine.id]
    assert "Globex" not in prompts[0] and "Acme" in prompts[0]


chat_db = pytest.mark.django_db(transaction=True)  # the agent's tool runs on its own DB connection


@chat_db
def test_the_agents_search_tool_is_scoped_to_the_runs_membership(member, two_orgs):
    config = {"configurable": {"membership_id": membership(member).id}}
    content, sources = agent.search_documents.func(SECRET, {"messages": [], "document_ids": []}, config)
    assert [s["id"] for s in sources] == [two_orgs.mine.id] and "Globex" not in content
    # Scoped to another organization's document: nothing, not that document
    content, sources = agent.search_documents.func(SECRET, {"messages": [], "document_ids": [two_orgs.theirs.id]}, config)
    assert sources == []


@chat_db
def test_chat_scope_drops_another_organizations_documents(api, member, two_orgs, script):  # noqa: F811
    script += [search_call("procurement ledger"), AIMessage("The Acme ledger [1]."), AIMessage("Ledger")]
    stream = dict(events(ask(api(member), question=f"What is the {SECRET}?", document_ids=[two_orgs.theirs.id])))
    assert {s["id"] for s in stream["answer"]["message"]["sources"]} == {two_orgs.mine.id}
    history = api(member).get(f"/api/chats/{stream['start']['chat']['id']}/messages/").json()
    assert history["scope"] == []


@pytest.mark.django_db
def test_vectors_from_another_embedding_model_are_never_compared(member, admin, org, cfg):
    current = ready(org, admin, "Current", "budget review meeting minutes")
    other_space = llm.build_settings("openai", "sk-x")  # e.g. indexed before the provider changed
    stale = ready(org, admin, "Stale", "budget review meeting minutes", cfg=other_space)
    assert stale.embedding_model == "openai:text-embedding-3-small"
    hits = {h.document.id: h for h in search.search("budget review meeting minutes", membership(member), cfg)}
    assert "vector" in hits[current.id].ranks
    assert hits[stale.id].ranks.keys() == {"keyword"}  # still found, by its words only


# --- Tags, dashboard, chats ------------------------------------------------------------------
@pytest.mark.django_db
def test_tags_are_per_organization(api, admin, guest, two_orgs):
    assert [t["id"] for t in api(admin).get("/api/tags/").json()] == [two_orgs.acme_tag.id]
    globex_tag = f"/api/tags/{two_orgs.globex_tag.id}/"
    assert api(admin).patch(globex_tag, {"name": "Taken"}, format="json").status_code == 404
    assert api(admin).delete(globex_tag).status_code == 404
    assert api(admin).post("/api/tags/", {"name": "procurement"}, format="json").status_code == 400  # same org, any case
    assert api(admin).post("/api/tags/", {"name": "Shipping"}, format="json").status_code == 201
    assert api(two_orgs.rival).post("/api/tags/", {"name": "Shipping"}, format="json").status_code == 201
    assert api(guest).post("/api/tags/", {"name": "Guest tag"}, format="json").status_code == 403


@pytest.mark.django_db
def test_dashboard_counts_only_the_organizations_library(api, member, two_orgs):
    body = api(member).get("/api/dashboard/").json()
    assert body["library"]["documents"] == 1
    assert [t["id"] for t in body["by_tag"]] == [two_orgs.acme_tag.id]


@pytest.mark.django_db
def test_chats_belong_to_one_organization(api, two_orgs):
    both = make_user("both@example.com", two_orgs.acme)
    Membership.objects.create(user=both, organization=two_orgs.globex, role=OrgRole.MEMBER.value)
    chat = Chat.objects.create(user=both, organization=two_orgs.acme, title="Acme chat")
    assert api(both, "globex").get("/api/chats/").json()["count"] == 0
    assert api(both, "globex").get(f"/api/chats/{chat.id}/messages/").status_code == 404
    assert api(both, "globex").delete(f"/api/chats/{chat.id}/").status_code == 404
    assert api(both, "acme").get("/api/chats/").json()["count"] == 1


# --- An organization without a provider ------------------------------------------------------
@pytest.mark.django_db
def test_an_organization_without_a_provider_is_read_only(api):
    initech = make_org("Initech", "initech", configured=False)
    peter = make_user("peter@initech.com", initech, OrgRole.ADMIN.value)
    client = api(peter)
    config = client.get("/api/config/").json()
    assert config["organization"]["ai_configured"] is False and "no AI provider" in config["organization"]["ai_error"]
    assert config["uploads_enabled"] is False and config["models"] is None
    assert client.get("/api/documents/").status_code == 200
    for response in (
        client.get("/api/search/", {"q": "anything"}),
        client.post("/api/search/answer/", {"q": "anything?"}, format="json"),
        client.post("/api/chats/stream/", {"question": "anything?"}, format="json"),
    ):
        assert response.status_code == 409 and response.json()["code"] == "ai_not_configured"
    assert not Chat.objects.exists()


@pytest.mark.django_db
def test_processing_fails_clearly_without_a_provider(org, admin):
    document = Document.objects.create(organization=org, file="docs/1/original.pdf", uploaded_by=admin)
    org.ai_provider = ""
    org.save()
    tasks.process_document(document.id)
    document.refresh_from_db()
    assert (document.status, document.is_failed) == ("extracting", True)
    assert "no AI provider" in document.error_message


# --- Provider settings and keys --------------------------------------------------------------
@pytest.mark.django_db
def test_settings_for_decrypts_the_key_and_never_prints_it(org):
    cfg = llm.settings_for(org)
    assert cfg.api_key == "sk-test-key-1234" and cfg.provider == "openrouter"
    assert "sk-test" not in repr(cfg) and "sk-test" not in org.ai_api_key  # stored encrypted
    assert cfg.chat_model == "qwen/qwen3-vl-30b-a3b-instruct" and cfg.reranker_model == ""  # "none" turns it off


@pytest.mark.django_db
def test_settings_for_refuses_unusable_configurations(org, settings):
    org.ai_api_key = ""
    with pytest.raises(llm.AINotConfigured, match="no API key"):
        llm.settings_for(org)
    org.ai_provider = "ollama"
    with pytest.raises(llm.AINotConfigured, match="aren't enabled"):
        llm.settings_for(org)
    org.ollama_allowed = True
    assert llm.settings_for(org).base_url == settings.OLLAMA_BASE_URL  # the server's, never the org's choice
    org.ai_provider, org.ai_api_key = "openai", "not-a-fernet-token"
    with pytest.raises(llm.AINotConfigured, match="can't be read"):
        llm.settings_for(org)


def test_secrets_round_trip_and_fail_under_another_key(settings):
    from cryptography.fernet import Fernet

    settings.FIELD_ENCRYPTION_KEY = Fernet.generate_key().decode()
    token = secrets.encrypt("sk-live-abc")
    assert token != "sk-live-abc" and secrets.decrypt(token) == "sk-live-abc"
    settings.FIELD_ENCRYPTION_KEY = Fernet.generate_key().decode()
    with pytest.raises(secrets.SecretUnavailable):
        secrets.decrypt(token)


def test_model_defaults_temperature_and_turning_roles_off(settings):
    openai = llm.build_settings("openai", "k", chat_model="  ")
    assert openai.chat_model == settings.PROVIDER_DEFAULTS["openai"]["chat_model"]
    assert not openai.supports_rerank and openai.supports_vision_ocr
    assert not llm.accepts_temperature(openai, "gpt-5-mini") and not llm.accepts_temperature(openai, "o4-mini")
    assert llm.accepts_temperature(openai, "gpt-4.1-mini")
    router = llm.build_settings("openrouter", "k", ocr_model="NONE")
    assert router.ocr_model == "" and not router.supports_vision_ocr and router.supports_rerank
    assert not llm.accepts_temperature(router, "openai/gpt-5")
    assert llm.accepts_temperature(llm.build_settings("ollama"), "qwen3:1.7b")
    with pytest.raises(llm.AINotConfigured):
        llm.build_settings("anthropic", "k")


@pytest.mark.django_db
def test_create_organization_applies_a_preset_and_its_admin(admin):
    created = organizations.create_organization("Acme", preset="msu-iit", admin=admin)
    assert created.slug == "acme-2"  # "acme" is taken by the test organization
    assert Tag.objects.filter(organization=created).count() == len(organizations.TAG_PRESETS["msu-iit"])
    assert membership(admin, created).role == "admin"
    with pytest.raises(ValueError):
        organizations.create_organization("Nope", preset="unknown")
