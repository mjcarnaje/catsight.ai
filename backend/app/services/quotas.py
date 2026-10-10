"""Public-demo limits: what a visitor may upload and ask, per rolling 24 hours.

Only active when DEMO_MODE is on, only in the demo organization (settings.DEMO_ORG,
whose key the operator pays for) and never for its admins: every other organization
pays with its own key and isn't limited. Usage is recorded in UsageEvent so deleting
a document or a guest account doesn't refund it, and the demo library's page budget
bounds total OCR spend however many guests sign up.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import timedelta
from typing import Optional

from django.conf import settings
from django.db import connection, transaction
from django.db.models import Sum
from django.utils import timezone

from ..constant import UsageKind
from ..models import Membership, UsageEvent

WINDOW = timedelta(hours=24)


class QuotaExceeded(Exception):
    """A limit was reached; `message` is shown to the user as-is."""

    def __init__(self, message: str, code: str):
        super().__init__(message)
        self.message = message
        self.code = code


@dataclass(frozen=True)
class Limits:
    uploads_per_day: int
    messages_per_day: int
    library_pages: int
    max_file_mb: int
    max_pages_per_file: int


def applies_to(membership: Optional[Membership]) -> bool:
    return bool(
        settings.DEMO_MODE
        and membership is not None
        and membership.organization.slug == settings.DEMO_ORG
        and not membership.is_admin
    )


def limits(membership: Optional[Membership] = None) -> Limits:
    """The limits for a member; visitor limits when no membership is given (signed out)."""
    visitor = membership is None or applies_to(membership)
    return Limits(
        uploads_per_day=settings.DEMO_DAILY_UPLOADS if visitor else 0,
        messages_per_day=settings.DEMO_DAILY_MESSAGES if visitor else 0,
        library_pages=settings.DEMO_LIBRARY_PAGE_LIMIT if visitor else 0,
        max_file_mb=settings.DEMO_MAX_UPLOAD_MB if visitor and settings.DEMO_MODE else settings.MAX_UPLOAD_MB,
        max_pages_per_file=settings.DEMO_MAX_UPLOAD_PAGES if visitor and settings.DEMO_MODE else settings.MAX_UPLOAD_PAGES,
    )


def _used(kind: UsageKind, membership: Membership, since=None, whole_organization: bool = False) -> int:
    """The member's uses of `kind` in their organization (pages, for the organization's whole library)."""
    events = UsageEvent.objects.filter(kind=kind.value, organization_id=membership.organization_id)
    if not whole_organization:
        events = events.filter(user_id=membership.user_id)
    if since is not None:
        events = events.filter(created_at__gte=since)
    if kind is UsageKind.UPLOAD and whole_organization:
        return events.aggregate(total=Sum("amount"))["total"] or 0  # pages
    return events.count()


def _resets_at(membership: Membership, kind: UsageKind) -> Optional[str]:
    """When the oldest event in the window expires, i.e. when one more is allowed."""
    oldest = (
        UsageEvent.objects.filter(
            user_id=membership.user_id,
            organization_id=membership.organization_id,
            kind=kind.value,
            created_at__gte=timezone.now() - WINDOW,
        )
        .order_by("created_at")
        .values_list("created_at", flat=True)
        .first()
    )
    return (oldest + WINDOW).isoformat() if oldest else None


def usage(membership: Membership) -> dict:
    """Current usage and limits in the member's organization, for the /api/config/ response."""
    since = timezone.now() - WINDOW
    lim = limits(membership)
    return {
        "limited": applies_to(membership),
        "uploads": {
            "used": _used(UsageKind.UPLOAD, membership, since),
            "limit": lim.uploads_per_day,
            "resets_at": _resets_at(membership, UsageKind.UPLOAD),
        },
        "messages": {
            "used": _used(UsageKind.MESSAGE, membership, since),
            "limit": lim.messages_per_day,
            "resets_at": _resets_at(membership, UsageKind.MESSAGE),
        },
        "library_pages": {
            "used": _used(UsageKind.UPLOAD, membership, whole_organization=True),
            "limit": lim.library_pages,
        },
    }


# All consumption is serialized by one transaction-scoped advisory lock, so two
# concurrent requests can't both pass a check before either is recorded. At demo
# traffic the lock is held for milliseconds.
_QUOTA_LOCK_ID = 7_412_002


def _check_upload(membership: Membership, pages: int) -> None:
    lim = limits(membership)
    since = timezone.now() - WINDOW
    if lim.uploads_per_day and _used(UsageKind.UPLOAD, membership, since) >= lim.uploads_per_day:
        raise QuotaExceeded(
            f"The demo allows {lim.uploads_per_day} uploads or re-runs per day. Try again tomorrow, or ask about the library's documents.",
            "upload_limit",
        )
    if lim.library_pages and _used(UsageKind.UPLOAD, membership, whole_organization=True) + pages > lim.library_pages:
        raise QuotaExceeded(
            "The demo's processing budget is used up for now, so new uploads are paused. You can still ask about the library.",
            "library_full",
        )


def _check_message(membership: Membership) -> None:
    lim = limits(membership)
    if lim.messages_per_day and _used(UsageKind.MESSAGE, membership, timezone.now() - WINDOW) >= lim.messages_per_day:
        raise QuotaExceeded(
            f"You've asked {lim.messages_per_day} questions today, the demo's daily limit. Come back tomorrow!",
            "message_limit",
        )


def consume(membership: Membership, kind: UsageKind, amount: int = 1) -> UsageEvent:
    """Atomically check the member's limit for `kind` and record the use.

    Raises QuotaExceeded (recording nothing) when over the limit. Unlimited users
    are recorded too, for the dashboard's activity numbers. `amount` is pages for
    uploads (0 for a re-run of an existing document) and 1 for a question.
    """
    with transaction.atomic():
        with connection.cursor() as cursor:
            cursor.execute("SELECT pg_advisory_xact_lock(%s)", [_QUOTA_LOCK_ID])
        if applies_to(membership):
            if kind is UsageKind.UPLOAD:
                _check_upload(membership, amount)
            else:
                _check_message(membership)
        return UsageEvent.objects.create(
            user_id=membership.user_id, organization_id=membership.organization_id, kind=kind.value, amount=amount
        )


def refund(event: UsageEvent) -> None:
    """Undo a consume() whose work didn't happen (e.g. the upload couldn't be saved)."""
    UsageEvent.objects.filter(pk=event.pk).delete()
