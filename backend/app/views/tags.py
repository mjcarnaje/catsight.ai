from django.db.models import Count, Q
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from ..models import Document, Tag
from ..serializers import TagSerializer
from ..utils.permissions import IsOrgAdminOrReadOnly


def _with_counts(request):
    """The organization's tags, each with how many documents the member can see carry it."""
    visible = Document.objects.visible_to(request.membership)
    return Tag.objects.filter(organization=request.organization).annotate(
        document_count=Count("documents", filter=Q(documents__in=visible), distinct=True)
    )


@api_view(["GET", "POST"])
@permission_classes([IsOrgAdminOrReadOnly])
def tags(request):
    if request.method == "POST":
        serializer = TagSerializer(data=request.data, context={"organization": request.organization})
        serializer.is_valid(raise_exception=True)
        serializer.save(author=request.user, organization=request.organization)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    return Response(TagSerializer(_with_counts(request), many=True).data)


@api_view(["GET", "PATCH", "DELETE"])
@permission_classes([IsOrgAdminOrReadOnly])
def tag_detail(request, tag_id: int):
    tag = get_object_or_404(_with_counts(request), pk=tag_id)
    if request.method == "DELETE":
        tag.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
    if request.method == "PATCH":
        serializer = TagSerializer(tag, data=request.data, partial=True, context={"organization": request.organization})
        serializer.is_valid(raise_exception=True)
        serializer.save()
    return Response(TagSerializer(tag).data)
