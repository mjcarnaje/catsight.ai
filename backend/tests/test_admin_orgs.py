"""The super admin's organization API, and the create_organization command.

The super admin manages organizations but gets no access to their data, and these
tests check that too: nothing in the admin API opens a membership or a library.
"""
from io import StringIO

import pytest
from django.core import mail
from django.core.management import call_command
from django.core.management.base import CommandError

from app.constant import OrgRole
from app.models import Chat, Document, Membership, Organization, Tag
from app.services import chats, storage
from app.views import admin_orgs

from .conftest import make_org, make_user, membership

ORGS = "/api/admin/organizations/"
MSU_IIT_TAGS = 13


@pytest.mark.django_db
def test_the_super_admin_lists_organizations_with_their_counts(api, super_admin, admin, member, org):
    make_org("Globex", "globex")
    Document.objects.create(organization=org, title="One", uploaded_by=admin)
    Document.objects.create(organization=org, title="Two", uploaded_by=admin)

    rows = api(super_admin).get(ORGS).json()
    assert [row["slug"] for row in rows] == ["acme", "globex"]  # by name
    acme, globex = rows
    assert set(acme) == {"id", "slug", "name", "created_at", "member_count", "document_count", "ai_provider", "ollama_allowed"}
    assert acme["member_count"] == 2 and acme["document_count"] == 2  # distinct: the two joins don't multiply
    assert acme["ai_provider"] == "openrouter" and acme["ollama_allowed"] is False
    assert globex["member_count"] == 0 and globex["document_count"] == 0


@pytest.mark.django_db
def test_organization_admins_and_members_cannot_use_the_admin_api(api, admin, member):
    for user in (admin, member):
        assert api(user).get(ORGS).status_code == 403
        assert api(user).post(ORGS, {"name": "Sneaky"}, format="json").status_code == 403
    assert api().get(ORGS).status_code in (401, 403)
    assert not Organization.objects.filter(name="Sneaky").exists()


@pytest.mark.django_db
def test_creating_an_organization_applies_its_tag_preset(api, super_admin):
    response = api(super_admin).post(ORGS, {"name": "MSU-IIT", "preset": "msu-iit"}, format="json")
    assert response.status_code == 201
    body = response.json()
    assert "invitation" not in body
    assert body["organization"]["slug"] == "msu-iit" and body["organization"]["member_count"] == 0

    created = Organization.objects.get(slug="msu-iit")
    assert Tag.objects.filter(organization=created).count() == MSU_IIT_TAGS == 13
    assert not Membership.objects.filter(organization=created).exists()  # add_me is false by default


@pytest.mark.django_db
def test_an_admin_email_gets_an_admin_invitation(api, super_admin):
    response = api(super_admin).post(ORGS, {"name": "Globex", "admin_email": "boss@globex.com"}, format="json")
    assert response.status_code == 201
    body = response.json()
    assert body["invitation"]["email_sent"] is True
    assert body["invitation"]["invitation"]["role"] == "admin"
    assert body["invitation"]["invitation"]["email"] == "boss@globex.com"

    [sent] = mail.outbox
    assert sent.to == ["boss@globex.com"] and body["invitation"]["link"] in sent.body
    boss = make_user("boss@globex.com")
    token = body["invitation"]["link"].rsplit("/invite/", 1)[1]
    assert api(boss).post(f"/api/invitations/{token}/accept/").status_code == 200
    assert membership(boss, Organization.objects.get(slug="globex")).role == OrgRole.ADMIN.value


@pytest.mark.django_db
def test_add_me_makes_the_super_admin_an_admin_of_the_new_organization(api, super_admin):
    response = api(super_admin).post(ORGS, {"name": "Initech", "add_me": True}, format="json")
    assert response.status_code == 201
    initech = Organization.objects.get(slug="initech")
    assert membership(super_admin, initech).role == OrgRole.ADMIN.value
    assert api(super_admin, initech).get("/api/organization/").json()["role"] == "admin"


@pytest.mark.django_db
def test_slugs_are_checked_and_a_taken_one_is_refused_not_changed(api, super_admin, org):
    client = api(super_admin)
    taken = client.post(ORGS, {"name": "Another", "slug": "acme"}, format="json")
    assert taken.status_code == 400 and taken.json()["code"] == "slug_taken"
    for bad in ("Bad Slug", "-leading", "double--hyphen", "x" * 51):
        assert client.post(ORGS, {"name": "Another", "slug": bad}, format="json").status_code == 400, bad
    assert client.post(ORGS, {"name": "Acme", "preset": "enterprise"}, format="json").status_code == 400
    assert client.post(ORGS, {"name": "  "}, format="json").status_code == 400
    assert client.post(ORGS, {"name": "x" * 201}, format="json").status_code == 400
    assert Organization.objects.count() == 1  # nothing was created

    created = client.post(ORGS, {"name": "Acme", "slug": "acme-ltd"}, format="json")
    assert created.status_code == 201 and created.json()["organization"]["slug"] == "acme-ltd"
    automatic = client.post(ORGS, {"name": "Acme"}, format="json")
    assert automatic.json()["organization"]["slug"] == "acme-2"  # "acme" is taken


@pytest.mark.django_db
def test_the_super_admin_edits_settings_but_reads_no_documents(api, super_admin, admin, org):
    private = Document.objects.create(organization=org, title="Private", uploaded_by=admin)
    url = f"{ORGS}{org.id}/"
    client = api(super_admin)

    response = client.patch(url, {"ollama_allowed": True}, format="json")
    assert response.status_code == 200 and response.json()["ollama_allowed"] is True
    org.refresh_from_db()
    assert org.ollama_allowed is True
    assert client.patch(url, {"name": "Acme Corp"}, format="json").json()["name"] == "Acme Corp"
    assert client.patch(url, {"name": ""}, format="json").status_code == 400

    assert api(admin, org).patch(url, {"ollama_allowed": False}, format="json").status_code == 403
    assert api(super_admin, org).get("/api/documents/").status_code == 403  # not a member
    assert api(super_admin).get(f"/api/documents/{private.id}/").status_code == 403


@pytest.mark.django_db
def test_deleting_needs_the_slug_as_confirmation(api, super_admin, org):
    url = f"{ORGS}{org.id}/"
    client = api(super_admin)
    for query in ("", "?confirm=ACME", "?confirm=acme-2"):
        response = client.delete(url + query)
        assert response.status_code == 400 and response.json()["code"] == "confirm_required", query
    assert Organization.objects.filter(pk=org.pk).exists()


@pytest.mark.django_db
def test_deleting_an_organization_removes_its_files_chats_and_members(api, super_admin, admin, member, org, monkeypatch):
    globex = make_org("Globex", "globex")
    rival = make_user("rival@globex.com", globex, OrgRole.ADMIN.value)
    first = Document.objects.create(organization=org, title="A", uploaded_by=admin)
    second = Document.objects.create(organization=org, title="B", uploaded_by=member)
    running = Document.objects.create(organization=org, title="C", uploaded_by=admin, task_id="task-42")
    keep = Document.objects.create(organization=globex, title="G", uploaded_by=rival)
    chat = Chat.objects.create(user=member, organization=org, title="Question")
    kept_chat = Chat.objects.create(user=rival, organization=globex, title="Other")

    removed_files, removed_chats, revoked = [], [], []

    def remember_chat_removal(chat):
        removed_chats.append(chat.id)
        chat.delete()

    class RecordingResult:
        def __init__(self, task_id):
            self.task_id = task_id

        def revoke(self, terminate=False):
            revoked.append((self.task_id, terminate))

    monkeypatch.setattr(storage, "delete_document_files", lambda document_id: removed_files.append(document_id))
    monkeypatch.setattr(chats, "delete_chat", remember_chat_removal)
    monkeypatch.setattr(admin_orgs, "AsyncResult", RecordingResult)

    response = api(super_admin).delete(f"{ORGS}{org.id}/?confirm=acme")
    assert response.status_code == 204
    assert not Organization.objects.filter(pk=org.pk).exists()
    assert not Document.objects.filter(pk__in=[first.id, second.id, running.id]).exists()
    assert not Chat.objects.filter(pk=chat.pk).exists()
    assert not Membership.objects.filter(organization_id=org.id).exists()
    assert sorted(removed_files) == sorted([first.id, second.id, running.id])
    assert removed_chats == [chat.id]
    assert revoked == [("task-42", True)]

    assert Document.objects.filter(pk=keep.pk).exists() and Chat.objects.filter(pk=kept_chat.pk).exists()
    assert membership(rival, globex).role == OrgRole.ADMIN.value


@pytest.mark.django_db
def test_the_management_command_creates_an_organization_for_an_admin(admin):
    out = StringIO()
    call_command(
        "create_organization", "Globex Ltd", slug="globex-ltd", preset="msu-iit", admin=admin.email.upper(), stdout=out
    )
    created = Organization.objects.get(slug="globex-ltd")
    assert created.name == "Globex Ltd"
    assert membership(admin, created).role == OrgRole.ADMIN.value
    assert Tag.objects.filter(organization=created).count() == MSU_IIT_TAGS
    assert "globex-ltd" in out.getvalue()


@pytest.mark.django_db
def test_the_management_command_refuses_a_taken_slug_an_unknown_admin_and_a_bad_slug(org):
    with pytest.raises(CommandError, match="already taken"):
        call_command("create_organization", "Another", slug="acme")
    with pytest.raises(CommandError, match="No user"):
        call_command("create_organization", "Another", admin="nobody@example.com")
    with pytest.raises(CommandError, match="slug uses"):
        call_command("create_organization", "Another", slug="Not Valid")
    assert Organization.objects.count() == 1
