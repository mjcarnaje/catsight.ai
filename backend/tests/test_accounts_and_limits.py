from datetime import timedelta

import pytest
from django.utils import timezone

from app.constant import UsageKind
from app.models import Chat, Document, UsageEvent, User
from app.services import quotas
from app.tasks.tasks import delete_expired_guests


@pytest.mark.django_db
def test_guest_sign_in_creates_a_limited_account(api, settings):
    settings.DEMO_MODE = settings.GUEST_ACCESS = True
    response = api().post("/api/auth/guest/")
    assert response.status_code == 201
    body = response.json()
    assert body["user"]["is_guest"] and body["tokens"]["access"]
    assert not User.objects.get(pk=body["user"]["id"]).has_usable_password()


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
        quotas.check_message(guest)
        quotas.record(guest, UsageKind.MESSAGE)
    with pytest.raises(quotas.QuotaExceeded) as error:
        quotas.check_message(guest)
    assert error.value.code == "message_limit"
    for _ in range(5):
        quotas.check_message(admin)
        quotas.record(admin, UsageKind.MESSAGE)


@pytest.mark.django_db
def test_usage_older_than_a_day_no_longer_counts(guest, settings):
    settings.DEMO_MODE = True
    settings.DEMO_DAILY_MESSAGES = 1
    UsageEvent.objects.create(user=guest, kind="message", created_at=timezone.now() - timedelta(hours=25))
    quotas.check_message(guest)  # doesn't raise


@pytest.mark.django_db
def test_library_page_budget_is_shared_and_survives_account_deletion(guest, member, settings):
    settings.DEMO_MODE = True
    settings.DEMO_LIBRARY_PAGE_LIMIT = 10
    quotas.record(guest, UsageKind.UPLOAD, amount=8)
    guest.delete()
    with pytest.raises(quotas.QuotaExceeded) as error:
        quotas.check_upload(member, pages=3)
    assert error.value.code == "library_full"


@pytest.mark.django_db
def test_config_reports_limits_and_usage(api, guest, settings):
    settings.DEMO_MODE = True
    anonymous = api().get("/api/config/").json()
    assert anonymous["demo_mode"] and "usage" not in anonymous
    signed_in = api(guest).get("/api/config/").json()
    assert signed_in["usage"]["limited"] and signed_in["usage"]["messages"]["used"] == 0


@pytest.mark.django_db
def test_expired_guests_are_removed_with_their_documents_and_chats(guest, member, settings, monkeypatch):
    from app.services import chats

    monkeypatch.setattr(chats, "delete_chat", lambda chat: chat.delete())
    settings.GUEST_TTL_HOURS = 24
    User.objects.filter(pk=guest.pk).update(date_joined=timezone.now() - timedelta(hours=30))
    Document.objects.create(uploaded_by=guest, is_private=True)
    Chat.objects.create(user=guest)
    kept = Document.objects.create(uploaded_by=member)

    assert delete_expired_guests() == 1
    assert not User.objects.filter(pk=guest.pk).exists()
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
