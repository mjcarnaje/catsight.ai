"""Management commands that set organizations up and take the database back to one library."""
import pytest
from django.core.management import CommandError, call_command

from app.models import Document, Organization
from app.services import llm, secrets

from .conftest import make_org


@pytest.mark.django_db
def test_configure_organization_takes_the_key_from_the_environment(monkeypatch, capsys):
    org = make_org("Default organization", "default", configured=False)
    monkeypatch.setenv("DEMO_OPENROUTER_KEY", "sk-or-from-env-9876")
    call_command("configure_organization", "default", "--name", "MSU-IIT", "--provider", "openrouter",
                 "--api-key-env", "DEMO_OPENROUTER_KEY")
    org.refresh_from_db()
    assert org.name == "MSU-IIT" and org.ai_provider == "openrouter"
    assert secrets.decrypt(org.ai_api_key) == "sk-or-from-env-9876" and org.ai_api_key_last4 == "9876"
    assert "sk-or-from-env" not in capsys.readouterr().out


@pytest.mark.django_db
def test_configure_organization_keeps_a_configured_provider_when_asked(monkeypatch, org):
    monkeypatch.setenv("OTHER_KEY", "sk-other-key-0000")
    call_command("configure_organization", "acme", "--provider", "openai", "--api-key-env", "OTHER_KEY",
                 "--if-unconfigured")
    org.refresh_from_db()
    assert org.ai_provider == "openrouter" and secrets.decrypt(org.ai_api_key) == "sk-test-key-1234"


@pytest.mark.django_db
def test_configure_organization_refuses_missing_keys_and_stale_vectors(monkeypatch, org, admin):
    with pytest.raises(CommandError, match="needs a key"):
        call_command("configure_organization", "acme", "--provider", "openai")
    monkeypatch.delenv("UNSET_KEY", raising=False)
    with pytest.raises(CommandError, match="empty or not set"):
        call_command("configure_organization", "acme", "--provider", "openai", "--api-key-env", "UNSET_KEY")

    Document.objects.create(organization=org, uploaded_by=admin, status="ready", chunk_count=2, file="x.pdf",
                            embedding_model="openrouter:baai/bge-m3")
    monkeypatch.setenv("OPENAI_KEY", "sk-openai-key-1111")
    with pytest.raises(CommandError, match="--reindex"):
        call_command("configure_organization", "acme", "--provider", "openai", "--api-key-env", "OPENAI_KEY")
    assert Organization.objects.get(pk=org.pk).ai_provider == "openrouter"  # nothing changed


@pytest.mark.django_db
def test_configure_organization_check_never_prints_the_key(monkeypatch, org):
    def failing(cfg):
        raise RuntimeError(f"401 Unauthorized for key {cfg.api_key}")

    monkeypatch.setattr(llm, "check", failing)
    monkeypatch.setenv("BAD_KEY", "sk-bad-key-2222")
    with pytest.raises(CommandError) as error:
        call_command("configure_organization", "acme", "--provider", "openrouter", "--api-key-env", "BAD_KEY", "--check")
    assert "sk-bad-key" not in str(error.value) and "[redacted]" in str(error.value)


@pytest.mark.django_db
def test_revert_to_single_library_refuses_several_organizations(org, monkeypatch):
    make_org("Globex", "globex")
    calls = []
    monkeypatch.setattr("app.management.commands.revert_to_single_library.call_command", lambda *a, **k: calls.append(a))
    with pytest.raises(CommandError, match="2 organizations"):
        call_command("revert_to_single_library")
    assert calls == []


@pytest.mark.django_db
def test_revert_to_single_library_migrates_back_with_one_organization(org, monkeypatch):
    calls = []
    monkeypatch.setattr("app.management.commands.revert_to_single_library.call_command", lambda *a, **k: calls.append(a))
    call_command("revert_to_single_library", "--dry-run")
    assert calls == []
    call_command("revert_to_single_library")
    assert calls == [("migrate", "app", "0021_remove_google_sign_in")]


@pytest.mark.django_db
def test_ensure_demo_organization_creates_it_once(monkeypatch, settings, capsys):
    from app.constant import UserRole

    from .conftest import make_user, membership

    settings.DEMO_ORG = "demo"
    root = make_user("root@example.com", role=UserRole.SUPER_ADMIN.value)
    monkeypatch.setenv("ADMIN_EMAIL", "Root@example.com")
    monkeypatch.setenv("OPENROUTER_API_KEY", "sk-or-demo-key-4321")
    call_command("ensure_demo_organization", "--name", "Tamsin Ridge Water Cooperative")
    org = Organization.objects.get(slug="demo")
    assert org.name == "Tamsin Ridge Water Cooperative" and org.tags.count() == 7  # the general preset
    assert membership(root, org).role == "admin"
    assert org.ai_provider == "openrouter" and secrets.decrypt(org.ai_api_key) == "sk-or-demo-key-4321"
    assert "sk-or-demo" not in capsys.readouterr().out

    # Running it again changes nothing an admin may have changed since
    org.name, org.ai_provider, org.ai_api_key = "Renamed", "openai", secrets.encrypt("sk-admin-chosen-0000")
    org.save()
    call_command("ensure_demo_organization", "--name", "Tamsin Ridge Water Cooperative")
    org.refresh_from_db()
    assert org.name == "Renamed" and secrets.decrypt(org.ai_api_key) == "sk-admin-chosen-0000"
    assert Organization.objects.count() == 1


@pytest.mark.django_db
def test_ensure_demo_organization_needs_demo_org(settings):
    settings.DEMO_ORG = ""
    with pytest.raises(CommandError, match="DEMO_ORG"):
        call_command("ensure_demo_organization")
