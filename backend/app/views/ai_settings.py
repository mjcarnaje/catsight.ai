"""STUB: replaced by the AI provider settings API."""
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response


def _todo(request, **kwargs):
    return Response({"detail": "Not implemented yet."}, status=status.HTTP_501_NOT_IMPLEMENTED)


ai_settings = api_view(["GET", "PUT"])(_todo)
