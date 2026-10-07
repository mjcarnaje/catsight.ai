from rest_framework import permissions
from rest_framework.permissions import AllowAny, IsAuthenticated  # noqa: F401  (re-exported for views)


class IsAdmin(permissions.BasePermission):
    """Admins and super admins only."""

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.is_admin)


class IsAdminOrReadOnly(permissions.BasePermission):
    """Anyone signed in may read; only admins may write."""

    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        return request.method in permissions.SAFE_METHODS or request.user.is_admin


def can_modify(user, document) -> bool:
    """Admins may change any document; others only the ones they uploaded."""
    if not (user and user.is_authenticated):
        return False
    return user.is_admin or document.uploaded_by_id == user.id
