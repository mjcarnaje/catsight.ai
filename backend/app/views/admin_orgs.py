"""Platform administration for the super admin: creating and managing organizations.

The super admin manages organizations here but reads none of their data. Documents
and chats are reachable only through a membership, which the rest of the API checks,
and nothing in this module grants one. Deleting an organization removes its files and
chats for good.
"""
import re

from celery.result import AsyncResult
from django.db.models import Count
from django.shortcuts import get_object_or_404
from rest_framework import serializers, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from ..constant import OrgRole
from ..models import Chat, Document, Organization
from ..services import chats, storage
from ..services import invitations as invites
from ..services import organizations as org_service
from ..utils.permissions import IsSuperAdmin
from .organization import sent_invitation

# The same rule as `manage.py create_organization`. unique_slug keeps at most 50
# characters, so a longer slug would come back changed: refuse it instead.
SLUG = re.compile(r"[a-z0-9]+(?:-[a-z0-9]+)*")
MAX_SLUG = 50


def _annotated():
    """Organizations with their member and document counts (distinct: the two joins multiply otherwise)."""
    return Organization.objects.annotate(
        member_count=Count("memberships", distinct=True),
        document_count=Count("documents", distinct=True),
    )


def _detail(organization: Organization) -> dict:
    return AdminOrganizationSerializer(_annotated().get(pk=organization.pk)).data


class AdminOrganizationSerializer(serializers.ModelSerializer):
    member_count = serializers.IntegerField(read_only=True, default=0)
    document_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = Organization
        fields = [
            "id", "slug", "name", "created_at", "member_count", "document_count", "ai_provider", "ollama_allowed",
        ]


class OrganizationCreateSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=200)
    slug = serializers.CharField(max_length=MAX_SLUG, required=False, allow_blank=True, default="")
    preset = serializers.ChoiceField(choices=list(org_service.TAG_PRESETS), default=org_service.DEFAULT_PRESET)
    admin_email = serializers.EmailField(required=False, allow_blank=True, default="")
    add_me = serializers.BooleanField(default=False)


class OrganizationEditSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=200, required=False)
    ollama_allowed = serializers.BooleanField(required=False)


@api_view(["GET", "POST"])
@permission_classes([IsSuperAdmin])
def organizations(request):
    if request.method == "POST":
        return _create(request)
    return Response(AdminOrganizationSerializer(_annotated(), many=True).data)


def _create(request) -> Response:
    serializer = OrganizationCreateSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    fields = serializer.validated_data
    slug = fields["slug"]
    if slug:
        if not SLUG.fullmatch(slug):
            return Response(
                {"detail": "A slug uses lowercase letters, numbers and single hyphens, such as msu-iit.", "code": "invalid_slug"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if Organization.objects.filter(slug=slug).exists():
            return Response(
                {"detail": f"The slug {slug!r} is already taken. Choose another.", "code": "slug_taken"},
                status=status.HTTP_400_BAD_REQUEST,
            )

    organization = org_service.create_organization(
        fields["name"], slug, fields["preset"], admin=request.user if fields["add_me"] else None
    )
    body = {"organization": _detail(organization)}
    if fields["admin_email"]:
        invitation, link = invites.issue(organization, fields["admin_email"], OrgRole.ADMIN.value, request.user)
        body["invitation"] = sent_invitation(invitation, link)
    return Response(body, status=status.HTTP_201_CREATED)


@api_view(["PATCH", "DELETE"])
@permission_classes([IsSuperAdmin])
def organization_detail(request, organization_id: int):
    organization = get_object_or_404(Organization, pk=organization_id)
    if request.method == "DELETE":
        return _delete(request, organization)
    serializer = OrganizationEditSerializer(data=request.data, partial=True)
    serializer.is_valid(raise_exception=True)
    for field, value in serializer.validated_data.items():
        setattr(organization, field, value)
    organization.save()
    return Response(_detail(organization))


def _delete(request, organization: Organization) -> Response:
    """Delete an organization with everything in it.

    The files and the chats' LangGraph checkpoints live outside the database, so they
    are removed one by one first; the database rows then go with the organization.
    `?confirm=<slug>` makes the super admin type the slug, so a click can't delete it.
    """
    if request.query_params.get("confirm") != organization.slug:
        return Response(
            {
                "detail": f"To delete {organization.name}, confirm with its slug: ?confirm={organization.slug}",
                "code": "confirm_required",
            },
            status=status.HTTP_400_BAD_REQUEST,
        )
    for document in Document.objects.filter(organization=organization).only("id", "task_id"):
        if document.task_id:
            AsyncResult(document.task_id).revoke(terminate=True)
        storage.delete_document_files(document.id)
    # Not inside one transaction: delete_chat tolerates a failed checkpoint query, which would abort a transaction
    for chat in list(Chat.objects.filter(organization=organization)):
        chats.delete_chat(chat)
    organization.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)
