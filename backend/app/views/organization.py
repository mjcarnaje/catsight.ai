"""STUB: replaced by the organization/invitation implementation."""
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response


def _todo(request, **kwargs):
    return Response({"detail": "Not implemented yet."}, status=status.HTTP_501_NOT_IMPLEMENTED)


organization_detail = api_view(["GET", "PATCH"])(_todo)
members = api_view(["GET"])(_todo)
member_detail = api_view(["PATCH", "DELETE"])(_todo)
invitations = api_view(["GET", "POST"])(_todo)
invitation_detail = api_view(["DELETE"])(_todo)
invitation_resend = api_view(["POST"])(_todo)
invitation_preview = api_view(["GET"])(_todo)
invitation_accept = api_view(["POST"])(_todo)
