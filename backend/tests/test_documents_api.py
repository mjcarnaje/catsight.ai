import pytest
from django.core.files.uploadedfile import SimpleUploadedFile

from app.constant import DocumentStatus
from app.models import Document, DocumentChunk, DocumentFullText
from app.services import extraction, summarization
from app.services.extraction import Page
from app.tasks import tasks

from .conftest import pdf_bytes


def upload(client, *files, **data):
    return client.post("/api/documents/", {"files": list(files), **data}, format="multipart")


def pdf(name="order.pdf", pages=1, seed="", content=None):
    return SimpleUploadedFile(name, content or pdf_bytes(pages, seed), content_type="application/pdf")


@pytest.mark.django_db
def test_upload_queues_pdfs_and_skips_exact_duplicates(api, admin, offline):
    client = api(admin)
    same_bytes = pdf_bytes(seed="a")  # pdfium writes a fresh /ID per save, so reuse one copy
    first = upload(client, pdf("a.pdf", content=same_bytes), pdf("b.pdf", seed="b"))
    assert first.status_code == 201
    assert [r["status"] for r in first.json()["results"]] == ["queued", "queued"]
    assert len(offline) == 2  # both handed to Celery

    again = upload(client, pdf("a-renamed.pdf", content=same_bytes))
    result = again.json()["results"][0]
    assert result["status"] == "duplicate"
    assert result["document_id"] == first.json()["results"][0]["document_id"]


@pytest.mark.django_db
def test_upload_rejects_non_pdfs_and_long_files(api, admin, guest, settings):
    settings.MAX_UPLOAD_PAGES = 2
    client = api(admin)
    fake = SimpleUploadedFile("notes.pdf", b"hello", content_type="application/pdf")
    results = upload(client, fake, pdf("long.pdf", pages=3)).json()["results"]
    assert [r["status"] for r in results] == ["rejected", "rejected"]
    assert "PDF" in results[0]["detail"] and "2 pages" in results[1]["detail"]

    # In the demo, visitors get tighter per-file limits than admins
    settings.DEMO_MODE, settings.DEMO_MAX_UPLOAD_PAGES, settings.MAX_UPLOAD_PAGES = True, 1, 50
    assert upload(api(admin), pdf("two.pdf", pages=2, seed="x")).json()["results"][0]["status"] == "queued"
    assert upload(api(guest), pdf("two.pdf", pages=2, seed="y")).json()["results"][0]["status"] == "rejected"


@pytest.mark.django_db
def test_demo_visitors_upload_privately_within_their_daily_limit(api, guest, member, settings):
    settings.DEMO_MODE = True
    settings.DEMO_DAILY_UPLOADS = 2
    client = api(guest)
    results = upload(client, *(pdf(f"{i}.pdf", seed=str(i)) for i in range(3))).json()["results"]
    assert [r["status"] for r in results] == ["queued", "queued", "rejected"]
    assert results[2]["code"] == "upload_limit"
    assert all(Document.objects.get(pk=r["document_id"]).is_private for r in results[:2])

    # Other visitors can't see them
    assert api(member).get("/api/documents/").json()["count"] == 0
    assert api(guest).get("/api/documents/").json()["count"] == 2


@pytest.mark.django_db
def test_only_uploader_or_admin_can_change_a_document(api, admin, member, guest):
    document = Document.objects.create(title="Library", uploaded_by=admin)
    assert api(member).patch(f"/api/documents/{document.id}/", {"title": "Hacked"}).status_code == 403
    assert api(guest).delete(f"/api/documents/{document.id}/").status_code == 403
    assert api(admin).patch(f"/api/documents/{document.id}/", {"title": "Fixed"}, format="json").json()["title"] == "Fixed"


@pytest.mark.django_db
def test_pipeline_runs_every_stage_and_resumes_after_a_failure(admin, monkeypatch, settings, tmp_path):
    document = Document.objects.create(file="docs/1/original.pdf", file_name="so.pdf", uploaded_by=admin, extractor="vision")
    monkeypatch.setattr(extraction, "extract", lambda path, extractor, on_progress=None: [
        Page(1, "## Special Order No. 00174-IIT\n\nGrant of cash incentive to Prof. B for a poster presentation."),
    ])
    calls = {"analyze": 0}

    def analyze(markdown, model=None):
        calls["analyze"] += 1
        if calls["analyze"] == 1:
            raise ValueError("The model returned nonsense.")
        return {"title": "Grant of Cash Incentive", "summary": "Grants an incentive.", "reference_number": "SO 00174-IIT",
                "issued_on": None, "year": 2017, "tag_ids": [], "questions": ["Who received a cash incentive in 2017?"]}

    monkeypatch.setattr(summarization, "analyze", analyze)

    tasks.process_document(document.id)
    document.refresh_from_db()
    assert (document.status, document.is_failed) == (DocumentStatus.SUMMARIZING.value, True)
    assert document.error_message == "The model returned nonsense."
    assert DocumentFullText.objects.filter(document=document).exists()

    monkeypatch.setattr(extraction, "extract", lambda *a, **k: pytest.fail("extraction must not re-run"))
    tasks.process_document(document.id)  # the retry resumes at summarizing
    document.refresh_from_db()
    assert (document.status, document.is_failed, document.error_message) == ("ready", False, "")
    assert document.title == "Grant of Cash Incentive" and document.year == 2017
    assert DocumentChunk.objects.filter(document=document).count() == document.chunk_count >= 1
    history = list(document.status_history.values_list("status", "is_failed"))
    assert history[:3] == [("extracting", False), ("summarizing", False), ("summarizing", True)]
    assert history[-1] == ("ready", False)


@pytest.mark.django_db
def test_signed_file_urls_expire_and_cannot_be_forged(api, admin, settings, tmp_path):
    from app.services import storage

    settings.MEDIA_ROOT = tmp_path
    document = Document.objects.create(file="docs/x/original.pdf", uploaded_by=admin)
    storage.document_dir(document.id).mkdir(parents=True)
    (storage.document_dir(document.id) / "original.pdf").write_bytes(pdf_bytes())

    url = storage.signed_file_url(document.id, "pdf")
    assert api().get(url).status_code == 200  # no login needed: the signature is the credential
    # Swap in another document's id but keep the old signature
    import base64, json
    token = url.split("/")[-2]
    payload, signature = token.split(":")
    data = json.loads(base64.urlsafe_b64decode(payload + "=" * (-len(payload) % 4)))
    data["d"] += 1
    forged_payload = base64.urlsafe_b64encode(json.dumps(data, separators=(",", ":")).encode()).decode().rstrip("=")
    assert api().get(f"/api/files/{forged_payload}:{signature}/").status_code == 404


@pytest.mark.django_db
def test_visitors_cannot_rerun_paid_stages_beyond_their_limit(api, guest, settings):
    settings.DEMO_MODE = True
    settings.DEMO_DAILY_UPLOADS = 1
    client = api(guest)
    ready = Document.objects.create(uploaded_by=guest, is_private=True, status="ready", file="x.pdf")
    assert client.post(f"/api/documents/{ready.id}/reprocess/", {"from": "summarizing"}).status_code == 403

    failed = Document.objects.create(uploaded_by=guest, is_private=True, status="summarizing", is_failed=True, file="y.pdf")
    assert client.post(f"/api/documents/{failed.id}/reprocess/").status_code == 200
    # It fails again; the first retry used today's allowance, so no more retries or edits
    Document.objects.filter(pk=failed.pk).update(is_failed=True)
    assert client.post(f"/api/documents/{failed.id}/reprocess/").status_code == 429
    assert client.put(f"/api/documents/{failed.id}/text/", {"markdown": "edited"}, format="json").status_code == 429


@pytest.mark.django_db
def test_avatars_are_reencoded_and_svg_is_refused(api, member, settings, tmp_path):
    import io

    from PIL import Image

    settings.MEDIA_ROOT = tmp_path
    client = api(member)
    svg = SimpleUploadedFile("x.svg", b'<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>', content_type="image/svg+xml")
    assert client.patch("/api/auth/me/", {"avatar": svg}, format="multipart").status_code == 400

    png = io.BytesIO()
    Image.new("RGB", (400, 300), "red").save(png, format="PNG")
    disguised = SimpleUploadedFile("evil.html", png.getvalue(), content_type="text/html")
    avatar = client.patch("/api/auth/me/", {"avatar": disguised}, format="multipart").json()["avatar"]
    assert avatar.startswith("/media/avatars/") and avatar.endswith(".webp")

    # A small file declaring a huge canvas is refused before its pixels are decoded
    bomb = io.BytesIO()
    Image.new("1", (5000, 5000)).save(bomb, format="PNG")
    assert len(bomb.getvalue()) < 2 * 1024 * 1024
    huge = SimpleUploadedFile("bomb.png", bomb.getvalue(), content_type="image/png")
    assert client.patch("/api/auth/me/", {"avatar": huge}, format="multipart").status_code == 400


@pytest.mark.django_db
def test_media_route_cannot_reach_documents(api, admin, settings, tmp_path):
    from app.services import storage

    settings.MEDIA_ROOT = tmp_path
    (tmp_path / "avatars").mkdir()
    (tmp_path / "avatars" / ("a" * 32 + ".webp")).write_bytes(b"RIFF")
    storage.document_dir(1).mkdir(parents=True)
    (storage.document_dir(1) / "original.pdf").write_bytes(b"%PDF-secret")

    client = api()
    assert client.get("/media/avatars/" + "a" * 32 + ".webp").status_code == 200
    for probe in ("/media/avatars/../docs/1/original.pdf", "/media/avatars/..%2fdocs/1/original.pdf",
                  "/media/avatars/%2e%2e/docs/1/original.pdf", "/media/docs/1/original.pdf"):
        assert client.get(probe).status_code == 404, probe
