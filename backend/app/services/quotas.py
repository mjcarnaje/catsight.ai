"""Public-demo limits: what a visitor may upload and ask, per rolling 24 hours.

Only active when DEMO_MODE is on, and never for admins. Usage is recorded in
UsageEvent so deleting a document or a guest account doesn't refund it, and the
library-wide page budget bounds total OCR spend however many guests sign up.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import timedelta
from typing import Optional

from django.conf import settings
from django.db.models import Sum
from django.utils import timezone

from ..constant import UsageKind
from ..models import UsageEvent

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


def applies_to(user) -> bool:
    return settings.DEMO_MODE and user.is_authenticated and not user.is_admin


def limits(user=None) -> Limits:
    """The limits for `user`; visitor limits when no user is given."""
    visitor = user is None or applies_to(user)
    return Limits(
        uploads_per_day=settings.DEMO_DAILY_UPLOADS if visitor else 0,
        messages_per_day=settings.DEMO_DAILY_MESSAGES if visitor else 0,
        library_pages=settings.DEMO_LIBRARY_PAGE_LIMIT if visitor else 0,
        max_file_mb=settings.DEMO_MAX_UPLOAD_MB if visitor and settings.DEMO_MODE else settings.MAX_UPLOAD_MB,
        max_pages_per_file=settings.DEMO_MAX_UPLOAD_PAGES if visitor and settings.DEMO_MODE else settings.MAX_UPLOAD_PAGES,
    )


def _used(kind: UsageKind, user=None, since=None) -> int:
    events = UsageEvent.objects.filter(kind=kind.value)
    if user is not None:
        events = events.filter(user=user)
    if since is not None:
        events = events.filter(created_at__gte=since)
    if kind is UsageKind.UPLOAD and user is None:
        return events.aggregate(total=Sum("amount"))["total"] or 0  # pages
    return events.count()


def _resets_at(user, kind: UsageKind) -> Optional[str]:
    """When the oldest event in the window expires, i.e. when one more is allowed."""
    oldest = (
        UsageEvent.objects.filter(user=user, kind=kind.value, created_at__gte=timezone.now() - WINDOW)
        .order_by("created_at")
        .values_list("created_at", flat=True)
        .first()
    )
    return (oldest + WINDOW).isoformat() if oldest else None


def usage(user) -> dict:
    """Current usage and limits, for the /api/config/ response."""
    since = timezone.now() - WINDOW
    lim = limits(user)
    return {
        "limited": applies_to(user),
        "uploads": {
            "used": _used(UsageKind.UPLOAD, user, since),
            "limit": lim.uploads_per_day,
            "resets_at": _resets_at(user, UsageKind.UPLOAD),
        },
        "messages": {
            "used": _used(UsageKind.MESSAGE, user, since),
            "limit": lim.messages_per_day,
            "resets_at": _resets_at(user, UsageKind.MESSAGE),
        },
        "library_pages": {"used": _used(UsageKind.UPLOAD), "limit": lim.library_pages},
    }


def check_upload(user, pages: int) -> None:
    """Raise QuotaExceeded if `user` may not upload a `pages`-page document now.

    Callers record() each accepted file before checking the next one, so a
    multi-file upload can't slip past the daily count.
    """
    if not applies_to(user):
        return
    lim = limits(user)
    since = timezone.now() - WINDOW
    if lim.uploads_per_day and _used(UsageKind.UPLOAD, user, since) >= lim.uploads_per_day:
        raise QuotaExceeded(
            f"The demo allows {lim.uploads_per_day} uploads or re-runs per day. Try again tomorrow, or ask about the library's documents.",
            "upload_limit",
        )
    if lim.library_pages and _used(UsageKind.UPLOAD) + pages > lim.library_pages:
        raise QuotaExceeded(
            "The demo's processing budget is used up for now, so new uploads are paused. You can still ask about the library.",
            "library_full",
        )


def check_message(user) -> None:
    if not applies_to(user):
        return
    lim = limits(user)
    if lim.messages_per_day and _used(UsageKind.MESSAGE, user, timezone.now() - WINDOW) >= lim.messages_per_day:
        raise QuotaExceeded(
            f"You've asked {lim.messages_per_day} questions today, the demo's daily limit. Come back tomorrow!",
            "message_limit",
        )


def record(user, kind: UsageKind, amount: int = 1) -> None:
    UsageEvent.objects.create(user=user, kind=kind.value, amount=amount)
