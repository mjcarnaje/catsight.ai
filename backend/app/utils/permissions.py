from rest_framework import permissions
from app.constant import UserRole
import logging

logger = logging.getLogger(__name__)

class AllowAny(permissions.AllowAny):
    """
    Allow all users to access the resource.
    """
    pass



class IsAuthenticated(permissions.IsAuthenticated):
    """
    Allows access only to authenticated users.
    """
    pass


class IsAdmin(permissions.BasePermission):
    """
    Allows access only to admin users.
    """
    def has_permission(self, request, view):
        return bool(
            request.user and 
            request.user.is_authenticated and 
            request.user.is_admin
        )


class IsSuperAdmin(permissions.BasePermission):
    """
    Allows access only to super admin users.
    """
    def has_permission(self, request, view):      
        return bool(
            request.user and 
            request.user.is_authenticated and 
            request.user.is_super_admin
        )


class IsAdminOrReadOnly(permissions.BasePermission):
    """
    Allows read access to all authenticated users, but only allows 
    write permissions to admin users.
    """
    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return bool(request.user and request.user.is_authenticated)
        return bool(request.user and request.user.is_authenticated and request.user.is_admin)


def can_modify(user, obj) -> bool:
    """Admins may modify anything; others only objects they uploaded."""
    if not (user and user.is_authenticated):
        return False
    if user.is_admin:
        return True
    return getattr(obj, 'uploaded_by_id', None) == user.id


class IsOwnerOrAdmin(permissions.BasePermission):
    """
    Allow owners of an object or admins to edit it.

    Function-based views never run object checks, so they must call
    can_modify(request.user, obj) themselves; this class only guarantees
    the user is logged in there.
    """
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated)

    def has_object_permission(self, request, view, obj):
        return can_modify(request.user, obj)