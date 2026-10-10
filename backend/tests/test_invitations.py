"""Invitations, members and an organization's settings, as its admins and members use them.

The invitation token is the only thing that proves who may join, so these tests cover
both sides: who may invite, who may accept, and what a link does once it's replaced,
revoked, used or expired.
"""
import hashlib
from datetime import timedelta

import pytest
from django.core import mail
from django.utils import timezone

from app.constant import OrgRole
from app.models import Chat, Invitation, Membership, User
from app.services import invitations as invites

from .conftest import make_org, make_user, membership

INVITATIONS = "/api/organization/invitations/"
MEMBERS = "/api/organization/members/"
REGISTER = "/api/auth/register/"


def invite(api, admin, org, email="new@example.com", role="member"):
    """Invite through the API as `admin`; returns the response body (with the link)."""
    response = api(admin, org).post(INVITATIONS, {"email": email, "role": role}, format="json")
    assert response.status_code == 201, response.content
    return response.json()


def token_of(link: str) -> str:
    return link.rsplit("/invite/", 1)[1]


def register_body(email, invite_token=None):
    return {
        "email": email,
        "first_name": "New",
        "last_name": "Person",
        "password": "a-long-password",
        "invite": invite_token or "",
    }


# --- Issuing ---------------------------------------------------------------------------------
@pytest.mark.django_db
def test_an_admin_invites_by_email_and_only_the_hash_is_stored(api, admin, org, settings):
    body = invite(api, admin, org, email="New.Person@Example.com")
    assert body["email_sent"] is True
    assert body["invitation"]["email"] == "new.person@example.com"
    assert body["invitation"]["status"] == "pending" and body["invitation"]["invited_by"] == admin.email

    token = token_of(body["link"])
    assert body["link"] == f"{settings.PUBLIC_URL}/invite/{token}"
    [sent] = mail.outbox
    assert sent.to == ["new.person@example.com"]
    assert sent.subject == "Join Acme on CATSight"
    assert body["link"] in sent.body
    assert not Invitation.objects.filter(token_hash=token).exists()
    assert Invitation.objects.filter(token_hash=hashlib.sha256(token.encode()).hexdigest()).exists()


@pytest.mark.django_db
def test_members_and_guests_cannot_invite(api, org, member, guest):
    for user in (member, guest):
        response = api(user, org).post(INVITATIONS, {"email": "x@example.com", "role": "member"}, format="json")
        assert response.status_code == 403
    assert not Invitation.objects.exists() and not mail.outbox


@pytest.mark.django_db
def test_inviting_an_existing_member_is_refused(api, admin, org, member):
    response = api(admin, org).post(INVITATIONS, {"email": "Member@Example.com", "role": "member"}, format="json")
    assert response.status_code == 400 and response.json()["code"] == "already_member"
    assert not mail.outbox


@pytest.mark.django_db
def test_only_admin_and_member_roles_can_be_invited_and_emails_must_be_valid(api, admin, org):
    client = api(admin, org)
    assert client.post(INVITATIONS, {"email": "a@example.com", "role": "guest"}, format="json").status_code == 400
    assert client.post(INVITATIONS, {"email": "a@example.com", "role": "owner"}, format="json").status_code == 400
    assert client.post(INVITATIONS, {"email": "not-an-email", "role": "member"}, format="json").status_code == 400
    assert client.post(INVITATIONS, {"email": "a@example.com", "role": "admin"}, format="json").status_code == 201
    assert not Invitation.objects.filter(role="guest").exists()


@pytest.mark.django_db
def test_inviting_the_same_address_again_retires_the_older_link(api, admin, org):
    first = token_of(invite(api, admin, org)["link"])
    second = token_of(invite(api, admin, org)["link"])
    assert api().get(f"/api/invitations/{first}/").status_code == 404
    assert api().get(f"/api/invitations/{second}/").status_code == 200
    assert Invitation.objects.filter(organization=org, email="new@example.com").count() == 1


@pytest.mark.django_db
def test_resending_issues_a_new_link_and_retires_the_old_one(api, admin, org):
    created = invite(api, admin, org)
    old = token_of(created["link"])
    url = f"{INVITATIONS}{created['invitation']['id']}/resend/"

    resent = api(admin, org).post(url)
    assert resent.status_code == 200 and resent.json()["email_sent"] is True
    new = token_of(resent.json()["link"])
    assert new != old
    assert api().get(f"/api/invitations/{old}/").status_code == 404
    assert api().get(f"/api/invitations/{new}/").status_code == 200
    assert len(mail.outbox) == 2 and mail.outbox[1].to == ["new@example.com"]
    assert resent.json()["link"] in mail.outbox[1].body

    invitee = make_user("new@example.com")
    assert api(invitee).post(f"/api/invitations/{new}/accept/").status_code == 200
    used = api(admin, org).post(url)
    assert used.status_code == 409 and used.json()["code"] == "already_used"


@pytest.mark.django_db
def test_revoking_an_invitation_kills_its_link(api, admin, org):
    created = invite(api, admin, org)
    response = api(admin, org).delete(f"{INVITATIONS}{created['invitation']['id']}/")
    assert response.status_code == 204
    assert api().get(f"/api/invitations/{token_of(created['link'])}/").status_code == 404
    assert not Invitation.objects.exists()


@pytest.mark.django_db
def test_a_failed_email_still_returns_the_link(api, admin, org, settings, monkeypatch):
    def broken(*args, **kwargs):
        raise ConnectionRefusedError("the mail server is down")

    monkeypatch.setattr("django.core.mail.send_mail", broken)
    response = api(admin, org).post(INVITATIONS, {"email": "new@example.com", "role": "member"}, format="json")
    assert response.status_code == 201
    body = response.json()
    assert body["email_sent"] is False and body["link"].startswith(settings.PUBLIC_URL)
    assert api().get(f"/api/invitations/{token_of(body['link'])}/").status_code == 200
    assert not mail.outbox


# --- Previewing and accepting ----------------------------------------------------------------
@pytest.mark.django_db
def test_the_preview_is_public_and_says_what_the_invitee_needs(api, admin, org):
    admin.first_name, admin.last_name = "Ana", "Reyes"
    admin.save()
    make_user("known@example.com")  # has an account already, though not in Acme
    known = token_of(invite(api, admin, org, email="known@example.com", role="admin")["link"])
    assert api().get(f"/api/invitations/{known}/").json() == {
        "organization": {"name": "Acme", "slug": "acme"},
        "email": "known@example.com",
        "role": "admin",
        "status": "pending",
        "invited_by_name": "Ana Reyes",
        "account_exists": True,
    }

    fresh = token_of(invite(api, admin, org, email="new@example.com")["link"])
    preview = api().get(f"/api/invitations/{fresh}/").json()
    assert preview["account_exists"] is False and preview["role"] == "member"


@pytest.mark.django_db
def test_an_unknown_or_revoked_link_is_not_found(api, org):
    assert api().get("/api/invitations/not-a-real-token/").status_code == 404
    outsider = make_user("someone@example.com")
    assert api(outsider).post("/api/invitations/not-a-real-token/accept/").status_code == 404


@pytest.mark.django_db
def test_only_the_invited_account_can_accept(api, admin, org):
    token = token_of(invite(api, admin, org, email="new@example.com")["link"])
    outsider = make_user("someone@example.com")
    response = api(outsider).post(f"/api/invitations/{token}/accept/")
    assert response.status_code == 403 and response.json()["code"] == "wrong_account"
    assert "new@example.com" in response.json()["detail"]
    assert not Membership.objects.filter(user=outsider).exists()
    assert api().post(f"/api/invitations/{token}/accept/").status_code in (401, 403)


@pytest.mark.django_db
def test_accepting_joins_the_organization_once(api, admin, org):
    token = token_of(invite(api, admin, org, email="new@example.com")["link"])
    invitee = make_user("new@example.com")
    response = api(invitee).post(f"/api/invitations/{token}/accept/")
    assert response.status_code == 200
    assert response.json()["membership"] == {
        "id": membership(invitee, org).id,
        "organization": {"id": org.id, "slug": "acme", "name": "Acme"},
        "role": "member",
    }
    assert api(invitee, org).get("/api/documents/").status_code == 200

    again = api(invitee).post(f"/api/invitations/{token}/accept/")
    assert again.status_code == 409 and again.json()["code"] == "already_used"
    assert api().get(f"/api/invitations/{token}/").json()["status"] == "accepted"


@pytest.mark.django_db
def test_an_expired_invitation_is_refused_at_registration_and_at_accept(api, admin, org):
    token = token_of(invite(api, admin, org, email="new@example.com")["link"])
    Invitation.objects.update(expires_at=timezone.now() - timedelta(minutes=1))
    assert api().get(f"/api/invitations/{token}/").json()["status"] == "expired"

    registered = api().post(REGISTER, register_body("new@example.com", token), format="json")
    assert registered.status_code == 400 and "expired" in registered.json()["invite"][0]
    assert not User.objects.filter(email="new@example.com").exists()

    invitee = make_user("new@example.com")
    response = api(invitee).post(f"/api/invitations/{token}/accept/")
    assert response.status_code == 410 and response.json()["code"] == "expired"
    assert not Membership.objects.filter(user=invitee).exists()


@pytest.mark.django_db
def test_accepting_never_downgrades_an_existing_member(admin, member, org):
    # An admin invitation raises an existing member to admin
    invitation, _ = invites.issue(org, member.email, OrgRole.ADMIN.value, admin)
    invites.accept(invitation, member)
    assert membership(member, org).role == "admin"

    # A member invitation leaves an admin as an admin
    invitation, _ = invites.issue(org, admin.email, OrgRole.MEMBER.value, admin)
    invites.accept(invitation, admin)
    assert membership(admin, org).role == "admin"


@pytest.mark.django_db
def test_accepting_raises_a_guest_to_the_invited_role(admin, guest, org):
    invitation, _ = invites.issue(org, guest.email, OrgRole.MEMBER.value, admin)
    invites.accept(invitation, guest)
    assert membership(guest, org).role == "member"


# --- Registering through an invitation -------------------------------------------------------
@pytest.mark.django_db
def test_registering_with_an_invitation_skips_the_domain_rule(api, admin, org, settings):
    settings.ALLOWED_EMAIL_DOMAINS = ["acme.org"]
    token = token_of(invite(api, admin, org, email="new.person@gmail.com")["link"])

    response = api().post(REGISTER, register_body("New.Person@gmail.com", token), format="json")
    assert response.status_code == 201
    user = User.objects.get(email="new.person@gmail.com")
    assert membership(user, org).role == "member"
    assert [m["organization"]["slug"] for m in response.json()["user"]["memberships"]] == ["acme"]

    # Without an invitation the same kind of address is still refused
    refused = api().post(REGISTER, register_body("other@gmail.com"), format="json")
    assert refused.status_code == 400 and "email" in refused.json()


@pytest.mark.django_db
def test_registering_with_an_invitation_for_another_address_is_refused(api, admin, org):
    token = token_of(invite(api, admin, org, email="new@example.com")["link"])
    response = api().post(REGISTER, register_body("other@example.com", token), format="json")
    assert response.status_code == 400 and "invite" in response.json()
    assert not User.objects.filter(email="other@example.com").exists()

    bogus = api().post(REGISTER, register_body("new@example.com", "nonsense"), format="json")
    assert bogus.status_code == 400 and "invite" in bogus.json()


# --- Members ---------------------------------------------------------------------------------
@pytest.mark.django_db
def test_the_members_list_is_for_admins_and_marks_you(api, admin, member, guest, org):
    rows = api(admin, org).get(MEMBERS).json()
    by_email = {row["user"]["email"]: row for row in rows}
    assert sorted(by_email) == sorted([admin.email, member.email, guest.email])
    assert by_email[admin.email]["is_you"] is True and by_email[admin.email]["role"] == "admin"
    assert by_email[admin.email]["id"] == membership(admin, org).id
    assert by_email[member.email]["is_you"] is False
    assert by_email[guest.email]["user"]["is_guest"] is True and by_email[member.email]["user"]["is_guest"] is False
    assert set(by_email[admin.email]["user"]) == {"id", "email", "first_name", "last_name", "avatar", "is_guest"}

    assert api(member, org).get(MEMBERS).status_code == 403
    assert api(guest, org).get(MEMBERS).status_code == 403


@pytest.mark.django_db
def test_roles_change_and_the_last_admin_is_protected(api, admin, member, org):
    admin_row = f"{MEMBERS}{membership(admin, org).id}/"
    member_row = f"{MEMBERS}{membership(member, org).id}/"

    # The only admin can neither step down nor be removed
    response = api(admin, org).patch(admin_row, {"role": "member"}, format="json")
    assert response.status_code == 400 and response.json()["code"] == "last_admin"
    response = api(admin, org).delete(admin_row)
    assert response.status_code == 400 and response.json()["code"] == "last_admin"

    # Bad roles are refused, and members can't change roles
    assert api(admin, org).patch(member_row, {"role": "owner"}, format="json").status_code == 400
    assert api(member, org).patch(member_row, {"role": "admin"}, format="json").status_code == 403

    # Once there's a second admin, the first can step down
    assert api(admin, org).patch(member_row, {"role": "admin"}, format="json").status_code == 200
    response = api(admin, org).patch(admin_row, {"role": "guest"}, format="json")
    assert response.status_code == 200 and response.json()["role"] == "guest" and response.json()["is_you"] is True

    # Now the sole admin is the member, who can't demote themselves either
    response = api(member, org).patch(member_row, {"role": "member"}, format="json")
    assert response.status_code == 400 and response.json()["code"] == "last_admin"


@pytest.mark.django_db
def test_admins_remove_members_and_members_leave_but_their_chats_stay(api, admin, member, guest, org):
    guest_row = f"{MEMBERS}{membership(guest, org).id}/"
    member_row = f"{MEMBERS}{membership(member, org).id}/"
    chat = Chat.objects.create(user=member, organization=org, title="Their question")

    assert api(member, org).delete(guest_row).status_code == 403  # a member can't remove someone else
    assert api(admin, org).delete(guest_row).status_code == 204
    assert api(member, org).delete(member_row).status_code == 204  # ...but can leave

    for removed in (guest, member):
        response = api(removed).get("/api/documents/")
        assert response.status_code == 403 and response.json()["code"] == "no_organization"
    assert api(member, org).get("/api/documents/").json()["code"] == "not_a_member"
    assert not Membership.objects.filter(organization=org, user__in=[guest, member]).exists()
    assert Chat.objects.filter(pk=chat.pk).exists()


@pytest.mark.django_db
def test_any_member_reads_the_organization_and_only_admins_rename_it(api, admin, member, guest, org):
    body = api(member, org).get("/api/organization/").json()
    assert set(body) == {"id", "slug", "name", "role", "member_count", "created_at"}
    assert body["slug"] == "acme" and body["role"] == "member" and body["member_count"] == 3

    denied = api(member, org).patch("/api/organization/", {"name": "Mine"}, format="json")
    assert denied.status_code == 403
    assert denied.json()["detail"] == "Only an organization admin can do this."

    renamed = api(admin, org).patch("/api/organization/", {"name": "  Acme Corporation  "}, format="json")
    assert renamed.status_code == 200 and renamed.json()["name"] == "Acme Corporation"
    org.refresh_from_db()
    assert org.name == "Acme Corporation"
    for bad in ("   ", "x" * 201):
        assert api(admin, org).patch("/api/organization/", {"name": bad}, format="json").status_code == 400


@pytest.mark.django_db
def test_other_organizations_memberships_and_invitations_are_not_found(api, admin, org):
    globex = make_org("Globex", "globex")
    rival = make_user("rival@globex.com", globex, OrgRole.ADMIN.value)
    row = membership(rival, globex).id
    invitation_id = invite(api, rival, globex, email="someone@globex.com")["invitation"]["id"]

    client = api(admin, org)  # an admin of Acme
    assert client.patch(f"{MEMBERS}{row}/", {"role": "member"}, format="json").status_code == 404
    assert client.delete(f"{MEMBERS}{row}/").status_code == 404
    assert client.delete(f"{INVITATIONS}{invitation_id}/").status_code == 404
    assert client.post(f"{INVITATIONS}{invitation_id}/resend/").status_code == 404
    assert Invitation.objects.filter(pk=invitation_id).exists()
    assert membership(rival, globex).role == "admin"
