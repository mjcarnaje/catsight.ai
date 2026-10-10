"""An organization's settings, members and invitations, as its admins manage them.

Everything here works on the request's organization (utils/permissions.py), so ids
that belong to another organization simply 404. The invitation links are the one
exception: the token is the credential. Its preview is public and shows only what
the invitee needs to decide; accepting needs a signed-in account at the invited
address (services/invitations.py).
"""
from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework import serializers, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from ..constant import OrgRole
from ..models import Invitation, Membership, Organization, User
from ..serializers import MembershipSerializer, _absolute_media
from ..services import invitations as invites
from ..services.organizations import admin_count
from ..utils.permissions import AllowAny, InOrganization, IsAuthenticated, IsOrgAdmin

ROLES = [role.value for role in OrgRole]
INVITABLE_ROLES = [OrgRole.ADMIN.value, OrgRole.MEMBER.value]
MAX_INVITATIONS = 100


class OrganizationSerializer(serializers.ModelSerializer):
    """The organization as the caller sees it; context["membership"] is their membership in it."""

    role = serializers.SerializerMethodField()
    member_count = serializers.SerializerMethodField()

    class Meta:
        model = Organization
        fields = ["id", "slug", "name", "role", "member_count", "created_at"]

    def get_role(self, organization: Organization) -> str:
        return self.context["membership"].role

    def get_member_count(self, organization: Organization) -> int:
        return organization.memberships.count()


class OrganizationNameSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=200)


class MemberUserSerializer(serializers.ModelSerializer):
    avatar = serializers.SerializerMethodField()
    is_guest = serializers.BooleanField(read_only=True)

    class Meta:
        model = User
        fields = ["id", "email", "first_name", "last_name", "avatar", "is_guest"]

    def get_avatar(self, user: User) -> str:
        return _absolute_media(user.avatar)


class MemberSerializer(serializers.ModelSerializer):
    """A membership. Its `id` is the membership's own; `is_you` marks the caller's row."""

    user = MemberUserSerializer(read_only=True)
    is_you = serializers.SerializerMethodField()

    class Meta:
        model = Membership
        fields = ["id", "user", "role", "created_at", "is_you"]

    def get_is_you(self, membership: Membership) -> bool:
        request = self.context.get("request")
        return bool(request and membership.user_id == request.user.id)


class MemberRoleSerializer(serializers.Serializer):
    role = serializers.ChoiceField(choices=ROLES)


class InvitationSerializer(serializers.ModelSerializer):
    status = serializers.SerializerMethodField()
    invited_by = serializers.SerializerMethodField()

    class Meta:
        model = Invitation
        fields = ["id", "email", "role", "status", "invited_by", "created_at", "expires_at", "accepted_at"]

    def get_status(self, invitation: Invitation) -> str:
        return invites.status_of(invitation)

    def get_invited_by(self, invitation: Invitation) -> str | None:
        return invitation.invited_by.email if invitation.invited_by else None


class InvitationRequestSerializer(serializers.Serializer):
    email = serializers.EmailField()
    role = serializers.ChoiceField(choices=INVITABLE_ROLES, default=OrgRole.MEMBER.value)


def sent_invitation(invitation: Invitation, link: str) -> dict:
    """An invitation after its email went out: the admin sees the link too, in case the email didn't arrive."""
    return {
        "invitation": InvitationSerializer(invitation).data,
        "link": link,
        "email_sent": invites.send(invitation, link),
    }


def _admins_only() -> Response:
    return Response({"detail": IsOrgAdmin.message}, status=status.HTTP_403_FORBIDDEN)


def _last_admin() -> Response:
    return Response(
        {"detail": "An organization needs at least one admin. Make someone else an admin first.", "code": "last_admin"},
        status=status.HTTP_400_BAD_REQUEST,
    )


def _no_such_invitation() -> Response:
    return Response(
        {"detail": "This invitation link doesn't exist. It may have been revoked or replaced.", "code": "not_found"},
        status=status.HTTP_404_NOT_FOUND,
    )


def _is_last_admin(organization: Organization, membership: Membership) -> bool:
    return membership.is_admin and admin_count(organization) <= 1


@api_view(["GET", "PATCH"])
@permission_classes([InOrganization])
def organization_detail(request):
    """The organization. Any member can read it; only an admin can rename it."""
    if request.method == "PATCH":
        if not request.membership.is_admin:
            return _admins_only()
        serializer = OrganizationNameSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        request.organization.name = serializer.validated_data["name"]
        request.organization.save(update_fields=["name", "updated_at"])
    return Response(OrganizationSerializer(request.organization, context={"membership": request.membership}).data)


@api_view(["GET"])
@permission_classes([IsOrgAdmin])
def members(request):
    memberships = (
        Membership.objects.filter(organization=request.organization).select_related("user").order_by("created_at", "id")
    )
    return Response(MemberSerializer(memberships, many=True, context={"request": request}).data)


@api_view(["PATCH", "DELETE"])
@permission_classes([InOrganization])
def member_detail(request, membership_id: int):
    """Change a member's role (admins), or remove a member (admins, or a member leaving on their own).

    Removing a membership keeps the person's chats and documents in the database: the
    library stays as it is, and the person can be invited back. An organization always
    keeps at least one admin, so the last admin can neither be demoted nor removed.
    """
    with transaction.atomic():
        # Locking the organization serializes admin changes, so two admins can't each
        # step down past the last-admin check at the same time.
        organization = Organization.objects.select_for_update().get(pk=request.organization.pk)
        target = get_object_or_404(
            Membership.objects.select_related("user"), pk=membership_id, organization=organization
        )
        if request.method == "PATCH":
            return _change_role(request, organization, target)
        return _remove(request, organization, target)


def _change_role(request, organization: Organization, target: Membership) -> Response:
    if not request.membership.is_admin:
        return _admins_only()
    serializer = MemberRoleSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    role = serializer.validated_data["role"]
    if role != OrgRole.ADMIN.value and _is_last_admin(organization, target):
        return _last_admin()
    target.role = role
    target.save(update_fields=["role"])
    return Response(MemberSerializer(target, context={"request": request}).data)


def _remove(request, organization: Organization, target: Membership) -> Response:
    if target.id != request.membership.id and not request.membership.is_admin:
        return _admins_only()
    if _is_last_admin(organization, target):
        return _last_admin()
    target.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(["GET", "POST"])
@permission_classes([IsOrgAdmin])
def invitations(request):
    if request.method == "POST":
        return _invite(request)
    rows = (
        Invitation.objects.filter(organization=request.organization)
        .select_related("invited_by")
        .order_by("-created_at", "-id")[:MAX_INVITATIONS]
    )
    return Response(InvitationSerializer(rows, many=True).data)


def _invite(request) -> Response:
    serializer = InvitationRequestSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    email = serializer.validated_data["email"].strip().lower()
    if Membership.objects.filter(organization=request.organization, user__email__iexact=email).exists():
        return Response(
            {"detail": f"{email} already belongs to this organization.", "code": "already_member"},
            status=status.HTTP_400_BAD_REQUEST,
        )
    invitation, link = invites.issue(request.organization, email, serializer.validated_data["role"], request.user)
    return Response(sent_invitation(invitation, link), status=status.HTTP_201_CREATED)


@api_view(["DELETE"])
@permission_classes([IsOrgAdmin])
def invitation_detail(request, invitation_id: int):
    """Revoke an invitation: deleting it makes its link stop working at once."""
    invitation = get_object_or_404(Invitation, pk=invitation_id, organization=request.organization)
    invitation.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(["POST"])
@permission_classes([IsOrgAdmin])
def invitation_resend(request, invitation_id: int):
    """Send the invitation again with a new link; the previous link stops working."""
    invitation = get_object_or_404(
        Invitation.objects.select_related("organization", "invited_by"),
        pk=invitation_id,
        organization=request.organization,
    )
    try:
        link = invites.reissue(invitation)
    except invites.InvitationError as e:
        return Response({"detail": e.message, "code": e.code}, status=e.status)
    return Response(sent_invitation(invitation, link))


@api_view(["GET"])
@permission_classes([AllowAny])
def invitation_preview(request, token: str):
    """What an invitation link is for, shown before anyone signs in."""
    invitation = invites.find(token)
    if invitation is None:
        return _no_such_invitation()
    return Response(
        {
            "organization": {"name": invitation.organization.name, "slug": invitation.organization.slug},
            "email": invitation.email,
            "role": invitation.role,
            "status": invites.status_of(invitation),
            "invited_by_name": invites.display_name(invitation.invited_by),
            "account_exists": User.objects.filter(email__iexact=invitation.email).exists(),
        }
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def invitation_accept(request, token: str):
    invitation = invites.find(token)
    if invitation is None:
        return _no_such_invitation()
    try:
        membership = invites.accept(invitation, request.user)
    except invites.InvitationError as e:
        return Response({"detail": e.message, "code": e.code}, status=e.status)
    return Response({"membership": MembershipSerializer(membership).data})
