"""Background jobs (Celery).

process_document runs the pipeline   queued → extracting → summarizing → indexing → ready
resuming from the document's current stage, so a retry after a failure only
re-runs what didn't finish, and editing the text restarts from summarizing.
Every stage runs with the document's organization's provider (llm.settings_for);
an organization without one fails the document with a message saying so.
"""
import logging
from datetime import timedelta

from celery import shared_task
from django.conf import settings
from django.db import transaction
from django.utils import timezone

from ..constant import STATUS_ORDER, DocumentStatus, UserRole
from ..models import Document, DocumentFullText, DocumentStatusHistory, User
from ..services import extraction, indexing, llm, storage, summarization
from ..services.errors import describe_error
from ..services.llm import ModelSettings

logger = logging.getLogger(__name__)

STAGES = [DocumentStatus.EXTRACTING, DocumentStatus.SUMMARIZING, DocumentStatus.INDEXING]


def set_status(document: Document, status: DocumentStatus, failed: bool = False, error: str = "") -> None:
    """Move the document to `status` and log the transition."""
    document.status = status.value
    document.is_failed = failed
    document.error_message = error
    if not failed:
        document.progress_done = document.progress_total = 0
    fields = ["status", "is_failed", "error_message", "progress_done", "progress_total", "updated_at"]
    if status is DocumentStatus.READY:
        document.processed_at = timezone.now()
        fields.append("processed_at")
    document.save(update_fields=fields)
    DocumentStatusHistory.objects.create(document=document, status=status.value, is_failed=failed)


def _progress(document_id: int):
    def report(done: int, total: int) -> None:
        Document.objects.filter(pk=document_id).update(progress_done=done, progress_total=total)
    return report


# --- Stages -------------------------------------------------------------------------------
def _extract(document: Document, cfg: ModelSettings) -> None:
    pages = extraction.extract(
        storage.absolute_path(document.file),
        document.extractor or extraction.default_extractor(cfg),
        cfg,
        on_progress=_progress(document.id),
    )
    DocumentFullText.objects.update_or_create(document=document, defaults={"text": extraction.join_pages(pages)})


def _summarize(document: Document, cfg: ModelSettings) -> None:
    # Always the organization's current chat model; the field records which model wrote the catalogue
    analysis = summarization.analyze(document.fulltext.text, cfg, document.organization)
    with transaction.atomic():
        document.title = analysis["title"]
        document.summary = analysis["summary"]
        document.reference_number = analysis["reference_number"]
        document.issued_on = analysis["issued_on"]
        document.year = analysis["year"]
        document.questions = analysis["questions"]
        document.summarization_model = cfg.chat_model[:100]
        document.save(update_fields=[
            "title", "summary", "reference_number", "issued_on", "year", "questions", "summarization_model", "updated_at",
        ])
        document.tags.set(analysis["tag_ids"])


def _index(document: Document, cfg: ModelSettings) -> None:
    document.chunk_count = indexing.index_document(
        document, document.fulltext.text, cfg, on_progress=_progress(document.id)
    )
    document.save(update_fields=["chunk_count", "updated_at"])


RUNNERS = {
    DocumentStatus.EXTRACTING: _extract,
    DocumentStatus.SUMMARIZING: _summarize,
    DocumentStatus.INDEXING: _index,
}


# --- Tasks --------------------------------------------------------------------------------
@shared_task(acks_late=True)
def process_document(document_id: int) -> None:
    try:
        document = Document.objects.select_related("organization").get(pk=document_id)
    except Document.DoesNotExist:
        logger.info(f"Document {document_id} was deleted before processing")
        return

    current = DocumentStatus(document.status)
    if current is DocumentStatus.READY and not document.is_failed:
        return
    start = max(STATUS_ORDER[current], STATUS_ORDER[DocumentStatus.EXTRACTING])
    try:
        cfg = llm.settings_for(document.organization)
    except llm.AINotConfigured as error:
        set_status(document, next(s for s in STAGES if STATUS_ORDER[s] >= start), failed=True, error=str(error))
        return

    for stage in STAGES:
        if STATUS_ORDER[stage] < start:
            continue
        set_status(document, stage)
        try:
            RUNNERS[stage](document, cfg)
        except Exception as error:
            logger.exception(f"Document {document_id} failed while {stage.value}")
            set_status(document, stage, failed=True, error=describe_error(error))
            return
        document.refresh_from_db()
    set_status(document, DocumentStatus.READY)
    logger.info(f"Document {document_id} is ready ({document.chunk_count} chunks)")


def reprocess(document: Document, from_stage: DocumentStatus) -> None:
    """Restart the pipeline at `from_stage` (e.g. SUMMARIZING after the text was edited)."""
    set_status(document, from_stage)
    result = process_document.delay(document.id)
    Document.objects.filter(pk=document.id).update(task_id=result.id)


@shared_task
def delete_expired_guests() -> int:
    """Remove guest accounts older than GUEST_TTL_HOURS, with their uploads and chats."""
    from ..services.chats import delete_chat

    cutoff = timezone.now() - timedelta(hours=settings.GUEST_TTL_HOURS)
    guests = list(User.objects.filter(role=UserRole.GUEST.value, date_joined__lt=cutoff))
    for guest in guests:
        for document in Document.objects.filter(uploaded_by=guest):
            storage.delete_document_files(document.id)
            document.delete()
        for chat in guest.chats.all():
            delete_chat(chat)
        guest.delete()
    if guests:
        logger.info(f"Deleted {len(guests)} expired guest accounts")
    return len(guests)
