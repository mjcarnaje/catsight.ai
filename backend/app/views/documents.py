import logging

from celery.result import AsyncResult
from django.conf import settings
from django.core import signing
from django.db.models import Q
from django.http import FileResponse, Http404
from rest_framework import status
from rest_framework.decorators import api_view, authentication_classes, parser_classes, permission_classes
from rest_framework.pagination import PageNumberPagination
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response

from ..constant import DocumentStatus, UsageKind
from ..models import Document, DocumentChunk, DocumentFullText
from ..serializers import DocumentDetailSerializer, DocumentSerializer, DocumentUpdateSerializer
from ..services import extraction, library, quotas, storage
from ..services.indexing import chunk_context
from ..services.search import update_search_vectors
from ..tasks.tasks import reprocess
from ..utils.permissions import AllowAny, IsAuthenticated, can_modify

logger = logging.getLogger(__name__)


MAX_TEXT_CHARS = 300_000  # an edited text is re-summarized and re-embedded: bound the cost


def _charge_processing_run(user) -> Response | None:
    """Re-running paid model calls counts as one of a visitor's daily uploads."""
    try:
        quotas.check_upload(user, pages=0)
    except quotas.QuotaExceeded as e:
        return Response({"detail": e.message, "code": e.code}, status=status.HTTP_429_TOO_MANY_REQUESTS)
    if quotas.applies_to(user):
        quotas.record(user, UsageKind.UPLOAD, amount=0)
    return None


class DocumentPagination(PageNumberPagination):
    page_size = 12
    page_size_query_param = "page_size"
    max_page_size = 100


def _csv_ints(value: str) -> list[int]:
    try:
        return [int(part) for part in value.split(",") if part.strip()]
    except ValueError:
        return []


def _get_visible(request, document_id: int) -> Document:
    document = Document.objects.visible_to(request.user).filter(pk=document_id).first()
    if document is None:
        raise Http404("Document not found")
    return document


def _forbidden() -> Response:
    return Response(
        {"detail": "Only the uploader or an admin can change this document."},
        status=status.HTTP_403_FORBIDDEN,
    )


@api_view(["GET", "POST"])
@parser_classes([MultiPartParser, FormParser, JSONParser])
@permission_classes([IsAuthenticated])
def documents(request):
    if request.method == "POST":
        return _upload(request)

    docs = Document.objects.visible_to(request.user).select_related("uploaded_by").prefetch_related("tags")
    params = request.query_params
    if q := params.get("q", "").strip():
        docs = docs.filter(
            Q(title__icontains=q) | Q(file_name__icontains=q) | Q(reference_number__icontains=q) | Q(summary__icontains=q)
        )
    match params.get("status"):
        case "ready":
            docs = docs.filter(status=DocumentStatus.READY.value, is_failed=False)
        case "processing":
            docs = docs.exclude(status=DocumentStatus.READY.value).filter(is_failed=False)
        case "failed":
            docs = docs.filter(is_failed=True)
    if years := _csv_ints(params.get("year", "")):
        docs = docs.filter(year__in=years)
    if tags := _csv_ints(params.get("tags", "")):
        docs = docs.filter(tags__id__in=tags).distinct()
    if params.get("mine") == "1":
        docs = docs.filter(uploaded_by=request.user)
    ordering = {"newest": "-created_at", "oldest": "created_at", "issued": "-issued_on", "title": "title"}
    docs = docs.order_by(ordering.get(params.get("sort", ""), "-created_at"), "-id")

    paginator = DocumentPagination()
    page = paginator.paginate_queryset(docs, request)
    serializer = DocumentSerializer(page, many=True, context={"request": request})
    return paginator.get_paginated_response(serializer.data)


def _upload(request):
    """Accept PDFs, skip duplicates, enforce limits and queue each for processing."""
    files = request.FILES.getlist("files")
    if not files:
        return Response({"detail": "Choose at least one PDF."}, status=status.HTTP_400_BAD_REQUEST)

    available = extraction.available_extractors()
    extractor = request.data.get("extractor") or settings.DEFAULT_TEXT_EXTRACTOR
    if extractor not in available:
        return Response(
            {"detail": f"The {extractor} extractor isn't available here. Options: {', '.join(available) or 'none'}."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    user = request.user
    # Public-demo uploads by visitors stay private so the shared library can't be changed
    private = quotas.applies_to(user) or str(request.data.get("private", "")).lower() in {"1", "true"}

    results = [library.add_document(user, upload, upload.name, extractor, private) for upload in files]
    accepted = any(r["status"] == "queued" for r in results)
    return Response({"results": results}, status=status.HTTP_201_CREATED if accepted else status.HTTP_200_OK)


@api_view(["GET", "PATCH", "DELETE"])
@permission_classes([IsAuthenticated])
def document_detail(request, document_id: int):
    document = _get_visible(request, document_id)

    if request.method == "GET":
        document = Document.objects.prefetch_related("tags", "status_history").select_related("uploaded_by").get(pk=document.pk)
        return Response(DocumentDetailSerializer(document, context={"request": request}).data)

    if not can_modify(request.user, document):
        return _forbidden()

    if request.method == "DELETE":
        if document.task_id:
            AsyncResult(document.task_id).revoke(terminate=True)
        storage.delete_document_files(document.id)
        document.delete()  # chunks, text and history cascade
        return Response(status=status.HTTP_204_NO_CONTENT)

    serializer = DocumentUpdateSerializer(document, data=request.data, partial=True)
    serializer.is_valid(raise_exception=True)
    serializer.save()
    if {"title", "reference_number", "year"} & set(request.data):
        # Keep each chunk's header in step with the corrected catalogue (no re-embedding)
        context = chunk_context(document)
        chunks = list(document.chunks.all())
        DocumentChunk.objects.filter(document=document).update(context=context)
        for chunk in chunks:
            chunk.context = context
        update_search_vectors(chunks)
    return Response(DocumentDetailSerializer(document, context={"request": request}).data)


@api_view(["GET", "PUT"])
@permission_classes([IsAuthenticated])
def document_text(request, document_id: int):
    """The extracted Markdown; saving an edit re-summarizes and re-indexes."""
    document = _get_visible(request, document_id)
    if request.method == "GET":
        fulltext = DocumentFullText.objects.filter(document=document).first()
        return Response({"markdown": fulltext.text if fulltext else ""})

    if not can_modify(request.user, document):
        return _forbidden()
    markdown = request.data.get("markdown")
    if not isinstance(markdown, str) or not markdown.strip():
        return Response({"detail": "The text can't be empty."}, status=status.HTTP_400_BAD_REQUEST)
    if len(markdown) > MAX_TEXT_CHARS:
        return Response({"detail": f"The text can be up to {MAX_TEXT_CHARS:,} characters."}, status=status.HTTP_400_BAD_REQUEST)
    if denied := _charge_processing_run(request.user):
        return denied
    DocumentFullText.objects.update_or_create(document=document, defaults={"text": markdown})
    reprocess(document, DocumentStatus.SUMMARIZING)
    return Response({"status": "queued"})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def document_chunks(request, document_id: int):
    document = _get_visible(request, document_id)
    chunks = document.chunks.values("id", "index", "page", "section", "text")
    return Response(list(chunks))


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def document_reprocess(request, document_id: int):
    """Retry a failed document, or redo a stage: {"from": "extracting"|"summarizing"|"indexing"}."""
    document = _get_visible(request, document_id)
    if not can_modify(request.user, document):
        return _forbidden()

    stage_name = request.data.get("from") or (document.status if document.is_failed else "extracting")
    try:
        stage = DocumentStatus(stage_name)
    except ValueError:
        return Response({"detail": f"Unknown stage {stage_name!r}."}, status=status.HTTP_400_BAD_REQUEST)
    if stage in (DocumentStatus.QUEUED, DocumentStatus.READY):
        stage = DocumentStatus.EXTRACTING

    if extractor := request.data.get("extractor"):
        if extractor not in extraction.available_extractors():
            return Response({"detail": f"The {extractor} extractor isn't available here."}, status=status.HTTP_400_BAD_REQUEST)
        document.extractor = extractor
        document.save(update_fields=["extractor"])
        stage = DocumentStatus.EXTRACTING
    if quotas.applies_to(request.user):
        # Visitors may retry a failed document; re-running finished stages is admin-only
        if not document.is_failed or stage.value != document.status:
            return Response({"detail": "In the demo you can retry a failed document, not re-run it."},
                            status=status.HTTP_403_FORBIDDEN)
        if denied := _charge_processing_run(request.user):
            return denied

    reprocess(document, stage)
    return Response({"status": "queued", "from": stage.value})


@api_view(["GET"])
@authentication_classes([])  # <img>/<iframe> requests carry no token; the signature is the credential
@permission_classes([AllowAny])
def signed_file(request, token: str):
    """A document's PDF or preview, behind a signed, expiring URL (see storage.signed_file_url)."""
    try:
        path = storage.resolve_signed_file(token)
    except (signing.BadSignature, FileNotFoundError, KeyError, TypeError):
        raise Http404("File not found")
    content_type = "application/pdf" if path.suffix == ".pdf" else "image/webp"
    response = FileResponse(open(path, "rb"), content_type=content_type)
    response["Cache-Control"] = "private, max-age=21600"
    return response
