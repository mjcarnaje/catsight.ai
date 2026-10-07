"""Uploaded PDFs on disk: validation, hashing, previews and cleanup.

Layout under MEDIA_ROOT:  docs/<document id>/original.pdf
                          docs/<document id>/preview.webp
"""
from __future__ import annotations

import hashlib
import io
import logging
import shutil
import time
from dataclasses import dataclass
from pathlib import Path

import pypdfium2 as pdfium
from django.conf import settings
from django.core import signing
from django.core.files import File as UploadedFile
from PIL import Image

logger = logging.getLogger(__name__)

PREVIEW_WIDTH = 640


class UploadRejected(ValueError):
    """The file can't be accepted; the message is shown to the user."""


@dataclass(frozen=True)
class UploadInfo:
    sha256: str
    size: int
    page_count: int


def inspect_upload(upload: UploadedFile, max_mb: int, max_pages: int) -> UploadInfo:
    """Check an upload is a readable PDF within the size and page limits."""
    if upload.size > max_mb * 1024 * 1024:
        raise UploadRejected(f"Files can be up to {max_mb} MB; this one is {upload.size / 1024 / 1024:.1f} MB.")

    digest = hashlib.sha256()
    head = b""
    for chunk in upload.chunks():
        if not head:
            head = chunk[:5]
        digest.update(chunk)
    if head != b"%PDF-":
        raise UploadRejected("Only PDF files are supported.")

    upload.seek(0)
    try:
        pdf = pdfium.PdfDocument(upload.read())
        page_count = len(pdf)
        pdf.close()
    except pdfium.PdfiumError as e:
        raise UploadRejected("This PDF couldn't be opened; it may be damaged or password-protected.") from e
    finally:
        upload.seek(0)

    if page_count == 0:
        raise UploadRejected("This PDF has no pages.")
    if max_pages and page_count > max_pages:
        raise UploadRejected(f"Documents can have up to {max_pages} pages; this one has {page_count}.")
    return UploadInfo(sha256=digest.hexdigest(), size=upload.size, page_count=page_count)


def document_dir(document_id: int) -> Path:
    return Path(settings.MEDIA_ROOT) / "docs" / str(document_id)


def save_upload(upload: UploadedFile, document_id: int) -> str:
    """Write the PDF to disk; returns its path relative to MEDIA_ROOT."""
    directory = document_dir(document_id)
    directory.mkdir(parents=True, exist_ok=True)
    target = directory / "original.pdf"
    with open(target, "wb") as out:
        for chunk in upload.chunks():
            out.write(chunk)
    return str(target.relative_to(settings.MEDIA_ROOT))


def absolute_path(relative: str) -> Path:
    return Path(settings.MEDIA_ROOT) / relative


def render_page(pdf_path: Path, index: int, dpi: int = 150) -> Image.Image:
    """Render one page (0-based) to a PIL image."""
    pdf = pdfium.PdfDocument(str(pdf_path))
    try:
        page = pdf[index]
        image = page.render(scale=dpi / 72).to_pil()
        page.close()
        return image.convert("RGB")
    finally:
        pdf.close()


def image_bytes(image: Image.Image, fmt: str = "JPEG", quality: int = 85) -> bytes:
    buffer = io.BytesIO()
    image.save(buffer, format=fmt, quality=quality, optimize=True)
    return buffer.getvalue()


def make_preview(document_id: int, pdf_path: Path) -> tuple[str, str]:
    """First-page thumbnail (WebP) and its blurhash; empty strings if rendering fails."""
    try:
        page = render_page(pdf_path, 0, dpi=110)
        page.thumbnail((PREVIEW_WIDTH, PREVIEW_WIDTH * 2))
        target = document_dir(document_id) / "preview.webp"
        page.save(target, format="WEBP", quality=80)
        return str(target.relative_to(settings.MEDIA_ROOT)), _blurhash(page)
    except Exception:
        logger.exception(f"Couldn't render a preview for document {document_id}")
        return "", ""


def _blurhash(image: Image.Image) -> str:
    try:
        import blurhash

        small = image.copy()
        small.thumbnail((64, 64))
        return blurhash.encode(small, x_components=4, y_components=3)
    except Exception:
        logger.warning("Blurhash generation failed", exc_info=True)
        return ""


def delete_document_files(document_id: int) -> None:
    shutil.rmtree(document_dir(document_id), ignore_errors=True)


# --- Signed file URLs -----------------------------------------------------------------
# Files are served by the API, not /media, because private uploads must not be
# readable by guessing document ids. URLs are signed and expire; the expiry is
# rounded to a 6-hour boundary so a URL stays the same (and cacheable) for hours.
FILE_KINDS = {"pdf": "original.pdf", "preview": "preview.webp"}
_URL_BUCKET_SECONDS = 6 * 3600


def signed_file_url(document_id: int, kind: str) -> str:
    expires = (int(time.time()) // _URL_BUCKET_SECONDS + 2) * _URL_BUCKET_SECONDS
    token = signing.Signer(salt="document-file").sign_object({"d": document_id, "k": kind, "e": expires})
    return f"/api/files/{token}/"


def resolve_signed_file(token: str) -> Path:
    """The file a signed token points to; raises signing.BadSignature or FileNotFoundError."""
    payload = signing.Signer(salt="document-file").unsign_object(token)
    if payload["e"] < time.time() or payload["k"] not in FILE_KINDS:
        raise signing.BadSignature("expired")
    path = document_dir(payload["d"]) / FILE_KINDS[payload["k"]]
    if not path.exists():
        raise FileNotFoundError(path)
    return path
