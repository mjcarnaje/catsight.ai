"""Adding documents to the library (shared by the upload API and `manage.py ingest`)."""
from __future__ import annotations

import logging
from typing import Any

from django.core.files import File

from ..constant import UsageKind
from ..models import Document
from . import quotas, storage

logger = logging.getLogger(__name__)


def add_document(user, upload: File, file_name: str, extractor: str, private: bool) -> dict[str, Any]:
    """Validate, dedupe, store and queue one PDF.

    Returns {"file_name", "status": "queued" | "duplicate" | "rejected", "document_id"?, "detail"?, "code"?}.
    """
    from ..tasks.tasks import process_document  # tasks imports services; avoid a cycle

    file_name = file_name[:1000]
    limits = quotas.limits(user)
    try:
        info = storage.inspect_upload(upload, limits.max_file_mb, limits.max_pages_per_file)
    except storage.UploadRejected as e:
        return {"file_name": file_name, "status": "rejected", "detail": str(e)}

    duplicate = Document.objects.visible_to(user).filter(file_hash=info.sha256).first()
    if duplicate:
        return {
            "file_name": file_name, "status": "duplicate", "document_id": duplicate.id,
            "detail": f"Already in the library as “{duplicate.title or duplicate.file_name}”.",
        }

    try:
        usage = quotas.consume(user, UsageKind.UPLOAD, amount=info.page_count)
    except quotas.QuotaExceeded as e:
        return {"file_name": file_name, "status": "rejected", "detail": e.message, "code": e.code}

    document = Document.objects.create(
        file_name=file_name, file_size=info.size, file_hash=info.sha256, page_count=info.page_count,
        extractor=extractor, uploaded_by=user, is_private=private,
    )
    try:
        document.file = storage.save_upload(upload, document.id)
        document.preview_image, document.blurhash = storage.make_preview(document.id, storage.absolute_path(document.file))
        document.save(update_fields=["file", "preview_image", "blurhash"])
    except Exception:
        logger.exception(f"Saving upload {file_name!r} failed")
        storage.delete_document_files(document.id)
        document.delete()
        quotas.refund(usage)
        return {"file_name": file_name, "status": "rejected", "detail": "The file couldn't be saved. Try again."}

    task = process_document.delay(document.id)
    Document.objects.filter(pk=document.id).update(task_id=task.id)
    return {"file_name": file_name, "status": "queued", "document_id": document.id}
