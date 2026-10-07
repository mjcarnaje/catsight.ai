"""App configuration and the dashboard's numbers."""
import random
from dataclasses import asdict
from datetime import timedelta

from django.conf import settings
from django.db import connection
from django.db.models import Count, Q, Sum
from django.db.models.functions import TruncMonth
from django.utils import timezone
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.response import Response

from ..constant import DocumentStatus, UsageKind
from ..models import Chat, Document, Tag, UsageEvent
from ..serializers import DocumentSerializer
from ..services import extraction, quotas
from ..utils.permissions import AllowAny, IsAuthenticated


@api_view(["GET"])
@authentication_classes([])
@permission_classes([AllowAny])
def health(request):
    """Liveness for scripts/catsight-remote and uptime checks: the database answers."""
    with connection.cursor() as cursor:
        cursor.execute("SELECT 1")
    return Response({"ok": True})


@api_view(["GET"])
@permission_classes([AllowAny])
def app_config(request):
    """What the frontend needs before rendering: modes, sign-in options, limits, models."""
    data = {
        "demo_mode": settings.DEMO_MODE,
        # For this visitor: admins can always upload
        "uploads_enabled": settings.UPLOADS_ENABLED or (request.user.is_authenticated and request.user.is_admin),
        "guest_access": settings.GUEST_ACCESS,
        "allowed_email_domains": settings.ALLOWED_EMAIL_DOMAINS,
        "provider": settings.LLM_PROVIDER,
        "models": {
            "chat": settings.CHAT_MODEL,
            "ocr": settings.OCR_MODEL,
            "embedding": settings.EMBEDDING_MODEL,
            "reranker": settings.RERANKER_MODEL,
        },
        # How PDFs become text, so the UI can name the OCR engine
        "extraction": {
            "default": settings.DEFAULT_TEXT_EXTRACTOR,
            "marker_llm": settings.MARKER_USE_LLM and bool(settings.OCR_MODEL),
        },
        "limits": asdict(quotas.limits(request.user if request.user.is_authenticated else None)),
        "guest_ttl_hours": settings.GUEST_TTL_HOURS,
    }
    if request.user.is_authenticated:
        data["usage"] = quotas.usage(request.user)
        data["extractors"] = {
            "default": settings.DEFAULT_TEXT_EXTRACTOR,
            "options": extraction.available_extractors(),
        }
    return Response(data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def dashboard(request):
    user = request.user
    docs = Document.objects.visible_to(user)
    ready = docs.filter(status=DocumentStatus.READY.value, is_failed=False)

    totals = ready.aggregate(pages=Sum("page_count"), passages=Sum("chunk_count"))
    # order_by() clears the default ordering, which would otherwise join the GROUP BY
    stage_counts = dict(
        docs.filter(is_failed=False).order_by().values("status").annotate(n=Count("id")).values_list("status", "n")
    )
    pipeline = {status.value: stage_counts.get(status.value, 0) for status in DocumentStatus}
    pipeline["failed"] = docs.filter(is_failed=True).count()

    active = (
        docs.filter(Q(is_failed=True) | ~Q(status=DocumentStatus.READY.value))
        .select_related("uploaded_by")
        .prefetch_related("tags")
        .order_by("-updated_at")[:8]
    )

    by_year = list(ready.exclude(year=None).values("year").annotate(count=Count("id")).order_by("year"))
    by_tag = list(
        Tag.objects.annotate(count=Count("documents", filter=Q(documents__in=ready)))
        .filter(count__gt=0)
        .order_by("-count", "name")
        .values("id", "name", "count")[:10]
    )
    since = timezone.now() - timedelta(days=365)
    timeline = [
        {"month": row["month"].strftime("%Y-%m"), "count": row["count"]}
        for row in docs.filter(created_at__gte=since)
        .annotate(month=TruncMonth("created_at"))
        .values("month")
        .annotate(count=Count("id"))
        .order_by("month")
    ]

    # Suggested questions written by the summarizer, a different handful each visit
    pool = [(q, doc_id) for doc_id, questions in ready.values_list("id", "questions") for q in questions or []]
    questions = [{"question": q, "document_id": d} for q, d in random.sample(pool, min(6, len(pool)))]

    month_ago = timezone.now() - timedelta(days=30)
    return Response({
        "library": {
            "documents": docs.count(),
            "ready": ready.count(),
            "pages": totals["pages"] or 0,
            "passages": totals["passages"] or 0,
            "tags": len(by_tag),
            "years": [by_year[0]["year"], by_year[-1]["year"]] if by_year else None,
        },
        "pipeline": pipeline,
        "active": DocumentSerializer(active, many=True, context={"request": request}).data,
        "by_year": by_year,
        "by_tag": by_tag,
        "timeline": timeline,
        "questions": questions,
        "activity": {
            "chats": Chat.objects.filter(user=user).count(),
            "questions_30d": UsageEvent.objects.filter(
                user=user, kind=UsageKind.MESSAGE.value, created_at__gte=month_ago
            ).count(),
        },
    })
