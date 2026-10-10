from datetime import timedelta

import pytest
from django.utils import timezone

from app.constant import UsageKind
from app.models import Chat, Document, Membership, UsageEvent, User
from app.services import quotas
from app.tasks.tasks import delete_expired_guests

from .conftest import make_org, make_user, membership


@pytest.mark.django_db
def test_guest_sign_in_creates_a_limited_account_in_the_demo_organization(api, org, settings):
    settings.DEMO_MODE = settings.GUEST_ACCESS = True
    response = api().post("/api/auth/guest/")
    assert response.status_code == 201
    body = response.json()
    assert body["user"]["is_guest"] and body["tokens"]["access"]
    joined = Membership.objects.get(user_id=body["user"]["id"])
    assert body["user"]["memberships"] == [
        {"id": joined.id, "organization": {"id": org.id, "slug": "acme", "name": "Acme"}, "role": "guest"}
    ]
    assert not User.objects.get(pk=body["user"]["id"]).has_usable_password()


@pytest.mark.django_db
def test_guest_sign_in_needs_the_demo_organization(api, settings):
    settings.DEMO_MODE = settings.GUEST_ACCESS = True
    response = api().post("/api/auth/guest/")
    assert response.status_code == 503 and response.json()["code"] == "demo_unavailable"
    assert not User.objects.exists()


@pytest.mark.django_db
def test_guest_sign_in_can_be_turned_off(api, settings):
    settings.GUEST_ACCESS = False
    assert api().post("/api/auth/guest/").status_code == 403


@pytest.mark.django_db
def test_registration_respects_allowed_domains(api, settings):
    settings.ALLOWED_EMAIL_DOMAINS = ["g.msuiit.edu.ph"]
    data = {"first_name": "A", "last_name": "B", "password": "a-long-password"}
    assert api().post("/api/auth/register/", {**data, "email": "a@gmail.com"}).status_code == 400
    assert api().post("/api/auth/register/", {**data, "email": "a@g.msuiit.edu.ph"}).status_code == 201
    login = api().post("/api/auth/login/", {"email": "A@g.msuiit.edu.ph", "password": "a-long-password"})
    assert login.status_code == 200


@pytest.mark.django_db
def test_message_limit_applies_to_visitors_not_admins(guest, admin, settings):
    settings.DEMO_MODE = True
    settings.DEMO_DAILY_MESSAGES = 2
    for _ in range(2):
        quotas.consume(membership(guest), UsageKind.MESSAGE)
    with pytest.raises(quotas.QuotaExceeded) as error:
        quotas.consume(membership(guest), UsageKind.MESSAGE)
    assert error.value.code == "message_limit"
    assert UsageEvent.objects.filter(user=guest).count() == 2  # the refused one isn't recorded
    for _ in range(5):
        quotas.consume(membership(admin), UsageKind.MESSAGE)


@pytest.mark.django_db
def test_demo_limits_only_apply_in_the_demo_organization(settings):
    settings.DEMO_MODE = True
    settings.DEMO_DAILY_MESSAGES = 1
    other = make_org("Globex", "globex")
    user = make_user("someone@globex.com", other)
    for _ in range(3):
        quotas.consume(membership(user), UsageKind.MESSAGE)  # pays with its own key: unlimited
    assert not quotas.applies_to(membership(user))


@pytest.mark.django_db
def test_usage_older_than_a_day_no_longer_counts(guest, org, settings):
    settings.DEMO_MODE = True
    settings.DEMO_DAILY_MESSAGES = 1
    UsageEvent.objects.create(
        user=guest, organization=org, kind="message", created_at=timezone.now() - timedelta(hours=25)
    )
    quotas.consume(membership(guest), UsageKind.MESSAGE)  # doesn't raise


@pytest.mark.django_db
def test_library_page_budget_is_shared_and_survives_account_deletion(org, settings):
    settings.DEMO_MODE = True
    settings.DEMO_LIBRARY_PAGE_LIMIT = 10
    first, second = make_user("first@example.com", org), make_user("second@example.com", org)
    quotas.consume(membership(first), UsageKind.UPLOAD, amount=8)
    first.delete()
    with pytest.raises(quotas.QuotaExceeded) as error:
        quotas.consume(membership(second), UsageKind.UPLOAD, amount=3)
    assert error.value.code == "library_full"


@pytest.mark.django_db
def test_config_reports_limits_usage_and_the_organization(api, guest, org, settings):
    settings.DEMO_MODE = True
    anonymous = api().get("/api/config/").json()
    assert anonymous["demo_mode"] and "usage" not in anonymous and anonymous["organization"] is None
    signed_in = api(guest).get("/api/config/").json()
    assert signed_in["usage"]["limited"] and signed_in["usage"]["messages"]["used"] == 0
    assert signed_in["organization"] == {
        "id": org.id, "slug": "acme", "name": "Acme", "role": "guest", "ai_configured": True, "ai_error": "",
    }
    assert signed_in["provider"] == "openrouter" and signed_in["models"]["reranker"] == ""


@pytest.mark.django_db
def test_expired_guests_are_removed_with_their_documents_and_chats(guest, member, org, settings, monkeypatch):
    from app.services import chats

    monkeypatch.setattr(chats, "delete_chat", lambda chat: chat.delete())
    settings.GUEST_TTL_HOURS = 24
    User.objects.filter(pk=guest.pk).update(date_joined=timezone.now() - timedelta(hours=30))
    Document.objects.create(organization=org, uploaded_by=guest, is_private=True)
    Chat.objects.create(user=guest, organization=org)
    kept = Document.objects.create(organization=org, uploaded_by=member)

    assert delete_expired_guests() == 1
    assert not User.objects.filter(pk=guest.pk).exists()
    assert not Membership.objects.filter(user_id=guest.pk).exists()
    assert list(Document.objects.all()) == [kept]
    assert not Chat.objects.exists()


@pytest.mark.django_db
def test_registration_rejects_weak_passwords_and_reserved_addresses(api):
    weak = api().post("/api/auth/register/", {"email": "a@x.com", "first_name": "A", "last_name": "B", "password": "password123"})
    assert weak.status_code == 400 and "password" in weak.json()
    reserved = api().post("/api/auth/register/", {
        "email": "guest-abc@guest.catsight.local", "first_name": "A", "last_name": "B", "password": "a-long-password",
    })
    assert reserved.status_code == 400


@pytest.mark.django_db(transaction=True)
def test_concurrent_requests_cannot_overspend_the_daily_limit(guest, settings):
    from concurrent.futures import ThreadPoolExecutor

    from django.db import connection

    settings.DEMO_MODE = True
    settings.DEMO_DAILY_MESSAGES = 3

    visitor = membership(guest)

    def ask(_):
        try:
            quotas.consume(visitor, UsageKind.MESSAGE)
            return True
        except quotas.QuotaExceeded:
            return False
        finally:
            connection.close()  # each thread opened its own connection

    with ThreadPoolExecutor(max_workers=8) as pool:
        allowed = sum(pool.map(ask, range(8)))
    assert allowed == 3
    assert UsageEvent.objects.filter(user=guest, kind="message").count() == 3
