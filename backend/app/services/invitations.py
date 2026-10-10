"""Invitation links: how people join an organization.

An invitation is a one-time link emailed to an address. The raw token exists only
in that link (and in the response that created it, shown once to the admin); the
database keeps its SHA-256, so a leaked database can't be used to join. Accepting
requires signing in as the invited address, so a forwarded link doesn't help anyone
else get in.
"""
from __future__ import annotations

import hashlib
import logging
from datetime import datetime, timedelta
from secrets import token_urlsafe

from django.conf import settings
from django.core import mail
from django.db import transaction
from django.utils import timezone

from ..constant import OrgRole
from ..models import Invitation, Membership, Organization, User

logger = logging.getLogger(__name__)

ROLE_WORDS = {OrgRole.ADMIN.value: "an admin", OrgRole.MEMBER.value: "a member", OrgRole.GUEST.value: "a guest"}
ROLE_RANK = {OrgRole.GUEST.value: 0, OrgRole.MEMBER.value: 1, OrgRole.ADMIN.value: 2}


class InvitationError(Exception):
    """An invitation can't be used; `status` is the HTTP status and `code` tells the client why."""

    def __init__(self, message: str, code: str, status: int = 400):
        super().__init__(message)
        self.message = message
        self.code = code
        self.status = status


def _hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def _expiry() -> datetime:
    return timezone.now() + timedelta(days=settings.INVITATION_TTL_DAYS)


def link_for(token: str) -> str:
    return f"{settings.PUBLIC_URL}/invite/{token}"


def display_name(user: User | None) -> str | None:
    """A person's full name, else their email; None when there is no one."""
    if user is None:
        return None
    return f"{user.first_name} {user.last_name}".strip() or user.email


def issue(organization: Organization, email: str, role: str, invited_by: User | None) -> tuple[Invitation, str]:
    """A new invitation for `email`, replacing any unaccepted ones for it; returns it with its link."""
    email = email.strip().lower()
    token = token_urlsafe(32)
    with transaction.atomic():
        Invitation.objects.filter(organization=organization, email=email, accepted_at__isnull=True).delete()
        invitation = Invitation.objects.create(
            organization=organization,
            email=email,
            role=role,
            token_hash=_hash(token),
            invited_by=invited_by,
            expires_at=_expiry(),
        )
    return invitation, link_for(token)


def reissue(invitation: Invitation) -> str:
    """A new token and expiry for the same invitation; the old link stops working. Returns the new link."""
    if invitation.accepted_at is not None:
        raise InvitationError("This invitation was already accepted.", code="already_used", status=409)
    token = token_urlsafe(32)
    invitation.token_hash = _hash(token)
    invitation.expires_at = _expiry()
    invitation.save(update_fields=["token_hash", "expires_at"])
    return link_for(token)


def find(token: str) -> Invitation | None:
    return Invitation.objects.select_related("organization", "invited_by").filter(token_hash=_hash(token)).first()


def status_of(invitation: Invitation) -> str:
    if invitation.accepted_at is not None:
        return "accepted"
    if invitation.expires_at <= timezone.now():
        return "expired"
    return "pending"


def send(invitation: Invitation, link: str) -> bool:
    """Email the link to the invitee. Returns False (and logs) if mail couldn't be sent."""
    organization = invitation.organization
    inviter = display_name(invitation.invited_by) or "An organization admin"
    role = ROLE_WORDS.get(invitation.role, invitation.role)
    expires = timezone.localtime(invitation.expires_at)
    body = (
        f"{inviter} invited you to join {organization.name} on CATSight as {role}.\n\n"
        f"Open this link to accept. Sign in, or create an account, with {invitation.email}:\n\n"
        f"{link}\n\n"
        f"The link expires on {expires:%B %d, %Y}. If you weren't expecting this invitation, ignore this email.\n"
    )
    try:
        mail.send_mail(
            f"Join {organization.name} on CATSight",
            body,
            settings.DEFAULT_FROM_EMAIL,
            [invitation.email],
            fail_silently=False,
        )
    except Exception:
        logger.exception(f"Couldn't send invitation {invitation.id} to {organization.slug}")
        return False
    return True


@transaction.atomic
def accept(invitation: Invitation, user: User) -> Membership:
    """Join the invitation's organization as `user`, or raise InvitationError.

    An existing membership is raised to the invitation's role (a demo guest invited as a
    member becomes a member) but never lowered.
    """
    # Lock the row so two requests can't both accept the same link
    locked = Invitation.objects.select_for_update().get(pk=invitation.pk)
    state = status_of(locked)
    if state == "accepted":
        raise InvitationError("This invitation has already been used.", code="already_used", status=409)
    if state == "expired":
        raise InvitationError("This invitation has expired. Ask for a new one.", code="expired", status=410)
    if user.email.strip().lower() != locked.email:
        raise InvitationError(
            f"This invitation is for {locked.email}. Sign in with that address to accept it.",
            code="wrong_account",
            status=403,
        )

    membership, created = Membership.objects.get_or_create(
        user=user, organization_id=locked.organization_id, defaults={"role": locked.role}
    )
    if not created and ROLE_RANK.get(locked.role, 0) > ROLE_RANK.get(membership.role, 0):
        membership.role = locked.role
        membership.save(update_fields=["role"])

    locked.accepted_at = timezone.now()
    locked.accepted_by = user
    locked.save(update_fields=["accepted_at", "accepted_by"])
    return membership
