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
from ..services import extraction, llm, organizations, quotas
from ..utils.permissions import AllowAny, InOrganization


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
    """What the frontend needs before rendering: modes, sign-in options, and, for a member,
    their organization (role, whether its AI provider works), limits and models."""
    membership = None
    if request.user.is_authenticated:
        try:
            membership = organizations.resolve(request)
        except organizations.OrganizationRequired:
            membership = None
    cfg, ai_error = None, ""
    if membership is not None:
        try:
            cfg = llm.settings_for(membership.organization)
        except llm.AINotConfigured as e:
            ai_error = str(e)

    data = {
        "demo_mode": settings.DEMO_MODE,
        "guest_access": settings.GUEST_ACCESS,
        "allowed_email_domains": settings.ALLOWED_EMAIL_DOMAINS,
        # For this member: guests never, members when uploads are on, admins always,
        # and only while the organization's provider works
        "uploads_enabled": bool(
            membership is not None
            and not membership.is_guest
            and cfg is not None
            and (settings.UPLOADS_ENABLED or membership.is_admin)
        ),
        "organization": None,
        "provider": cfg.provider if cfg else "",
        "models": {
            "chat": cfg.chat_model,
            "ocr": cfg.ocr_model,
            "embedding": cfg.embedding_model,
            "reranker": cfg.reranker_model if cfg.supports_rerank else "",
        } if cfg else None,
        # How PDFs become text, so the UI can name the OCR engine
        "extraction": {
            "default": extraction.default_extractor(cfg),
            "marker_llm": settings.MARKER_USE_LLM and bool(cfg and cfg.ocr_model),
        },
        "limits": asdict(quotas.limits(membership)),
        "guest_ttl_hours": settings.GUEST_TTL_HOURS,
    }
    if membership is not None:
        organization = membership.organization
        data["organization"] = {
            "id": organization.id,
            "slug": organization.slug,
            "name": organization.name,
            "role": membership.role,
            "ai_configured": cfg is not None,
            "ai_error": ai_error,
        }
        data["usage"] = quotas.usage(membership)
        data["extractors"] = {
            "default": extraction.default_extractor(cfg),
            "options": extraction.available_extractors(cfg),
        }
    return Response(data)


@api_view(["GET"])
@permission_classes([InOrganization])
def dashboard(request):
    user = request.user
    docs = Document.objects.visible_to(request.membership)
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
        Tag.objects.filter(organization=request.organization)
        .annotate(count=Count("documents", filter=Q(documents__in=ready)))
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
            "chats": Chat.objects.filter(user=user, organization=request.organization).count(),
            "questions_30d": UsageEvent.objects.filter(
                user=user, organization=request.organization, kind=UsageKind.MESSAGE.value, created_at__gte=month_ago
            ).count(),
        },
    })
