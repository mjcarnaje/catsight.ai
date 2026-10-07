"""Shared fixtures. No test calls a real model: embeddings and chat are faked."""
import hashlib
import io
import math
import re

import pypdfium2 as pdfium
import pytest
from django.conf import settings as django_settings

from app.constant import UserRole
from app.models import User

DIMENSIONS = django_settings.EMBEDDING_DIMENSIONS


def fake_vector(text: str) -> list[float]:
    """Bag of hashed words, L2-normalised: cosine similarity tracks word overlap."""
    vector = [0.0] * DIMENSIONS
    for word in re.findall(r"\w+", text.lower()):
        vector[int(hashlib.md5(word.encode()).hexdigest(), 16) % DIMENSIONS] += 1.0
    norm = math.sqrt(sum(v * v for v in vector)) or 1.0
    return [v / norm for v in vector]


@pytest.fixture(autouse=True)
def offline(settings, monkeypatch):
    """Fake embeddings, no reranking, no Celery broker, local cache."""
    from app.services import llm
    from app.tasks import tasks

    settings.CACHES = {"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}}
    settings.RERANKER_MODEL = ""
    settings.MEDIA_ROOT = settings.BASE_DIR / ".pytest_media"
    monkeypatch.setattr(llm, "embed_documents", lambda texts: [fake_vector(t) for t in texts])
    monkeypatch.setattr(llm, "embed_query", fake_vector)
    queued = []
    monkeypatch.setattr(tasks.process_document, "delay", lambda doc_id: queued.append(doc_id) or _FakeResult())
    monkeypatch.setattr(tasks.delete_expired_guests, "delay", lambda: None)
    return queued


class _FakeResult:
    id = "test-task"


def make_user(email, role=UserRole.USER.value, **extra):
    return User.objects.create_user(email=email, username=email, password="correct-horse-battery", role=role, **extra)


@pytest.fixture
def admin(db):
    return make_user("admin@example.com", UserRole.SUPER_ADMIN.value)


@pytest.fixture
def member(db):
    return make_user("member@example.com")


@pytest.fixture
def guest(db):
    return make_user("guest-1@guest.catsight.local", UserRole.GUEST.value)


@pytest.fixture
def api():
    from rest_framework.test import APIClient

    def client_for(user=None):
        client = APIClient()
        if user is not None:
            client.force_authenticate(user)
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
