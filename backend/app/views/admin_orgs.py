"""STUB: replaced by the super admin organization API."""
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response


def _todo(request, **kwargs):
    return Response({"detail": "Not implemented yet."}, status=status.HTTP_501_NOT_IMPLEMENTED)


organizations = api_view(["GET", "POST"])(_todo)
organization_detail = api_view(["PATCH", "DELETE"])(_todo)
