"""Shared fixtures. No test calls a real model: embeddings and chat are faked.

Every test user belongs to the organization `org` ("Acme"), whose provider is
OpenRouter with a fake encrypted key and reranking turned off. Model calls that
aren't faked fail the test (pytest.fail isn't caught by `except Exception`).
Set TEST_DB_SUFFIX to give a parallel test run its own test database.
"""
import hashlib
import io
import math
import os
import re

import pypdfium2 as pdfium
import pytest
from django.conf import settings as django_settings

from app.constant import OrgRole, UserRole
from app.models import Membership, Organization, User

DIMENSIONS = django_settings.EMBEDDING_DIMENSIONS


@pytest.fixture(scope="session")
def django_db_modify_db_settings():
    suffix = os.environ.get("TEST_DB_SUFFIX", "").strip()
    if suffix:
        db = django_settings.DATABASES["default"]
        db.setdefault("TEST", {})["NAME"] = f"test_{db['NAME']}_{suffix}"


def fake_vector(text: str) -> list[float]:
    """Bag of hashed words, L2-normalised: cosine similarity tracks word overlap."""
    vector = [0.0] * DIMENSIONS
    for word in re.findall(r"\w+", text.lower()):
        vector[int(hashlib.md5(word.encode()).hexdigest(), 16) % DIMENSIONS] += 1.0
    norm = math.sqrt(sum(v * v for v in vector)) or 1.0
    return [v / norm for v in vector]


def _no_network(name):
    def refuse(*args, **kwargs):
        pytest.fail(f"llm.{name} was called for real in a test; fake it")
    return refuse


@pytest.fixture(autouse=True)
def offline(settings, monkeypatch):
    """Fake embeddings, no real model calls, no Celery broker, local cache."""
    from app.services import llm
    from app.tasks import tasks

    settings.CACHES = {"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}}
    settings.MEDIA_ROOT = settings.BASE_DIR / ".pytest_media"
    settings.DEMO_ORG = "acme"
    settings.EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"
    monkeypatch.setattr(llm, "embed_documents", lambda cfg, texts: [fake_vector(t) for t in texts])
    monkeypatch.setattr(llm, "embed_query", lambda cfg, text: fake_vector(text))
    for name in ("get_embeddings", "rerank", "transcribe_image", "check"):
        monkeypatch.setattr(llm, name, _no_network(name))
    queued = []
    monkeypatch.setattr(tasks.process_document, "delay", lambda doc_id: queued.append(doc_id) or _FakeResult())
    monkeypatch.setattr(tasks.delete_expired_guests, "delay", lambda: None)
    return queued


class _FakeResult:
    id = "test-task"


def configure_ai(organization, provider="openrouter", key="sk-test-key-1234", **models):
    """Give an organization a working (fake) provider; reranking is off unless asked for."""
    from app.services import secrets

    organization.ai_provider = provider
    organization.ai_api_key = secrets.encrypt(key) if key else ""
    organization.ai_api_key_last4 = key[-4:] if key else ""
    organization.reranker_model = models.pop("reranker_model", "none")
    for field, value in models.items():
        setattr(organization, field, value)
    organization.save()
    return organization


def make_org(name, slug, configured=True):
    organization = Organization.objects.create(name=name, slug=slug)
    return configure_ai(organization) if configured else organization


def make_user(email, org=None, org_role=OrgRole.MEMBER.value, role=UserRole.USER.value, **extra):
    user = User.objects.create_user(email=email, username=email, password="correct-horse-battery", role=role, **extra)
    if org is not None:
        Membership.objects.create(user=user, organization=org, role=org_role)
    return user


def membership(user, org=None) -> Membership:
    """The user's membership (in `org`, or their only one), with its organization loaded."""
    memberships = Membership.objects.select_related("organization", "user").filter(user=user)
    return memberships.get(organization=org) if org is not None else memberships.get()


@pytest.fixture
def org(db):
    return make_org("Acme", "acme")


@pytest.fixture
def cfg(org):
    from app.services import llm

    return llm.settings_for(org)


@pytest.fixture
def admin(org):
    """An organization admin of Acme."""
    return make_user("admin@example.com", org, OrgRole.ADMIN.value)


@pytest.fixture
def member(org):
    return make_user("member@example.com", org)


@pytest.fixture
def guest(org):
    return make_user("guest-1@guest.catsight.local", org, OrgRole.GUEST.value, role=UserRole.GUEST.value)


@pytest.fixture
def super_admin(db):
    """The platform's super admin, in no organization."""
    return make_user("root@example.com", role=UserRole.SUPER_ADMIN.value)


@pytest.fixture
def api():
    from rest_framework.test import APIClient

    def client_for(user=None, org=None):
        client = APIClient()
        if user is not None:
            client.force_authenticate(user)
        if org is not None:
            client.credentials(HTTP_X_ORGANIZATION=org.slug if hasattr(org, "slug") else org)
        return client

    return client_for


def pdf_bytes(pages: int = 1, seed: str = "") -> bytes:
    """A blank PDF; `seed` changes its bytes so dedupe sees a different file."""
    document = pdfium.PdfDocument.new()
    for _ in range(pages):
        document.new_page(612, 792)
    buffer = io.BytesIO()
    document.save(buffer)
    return buffer.getvalue() + f"\n%{seed}\n".encode()
