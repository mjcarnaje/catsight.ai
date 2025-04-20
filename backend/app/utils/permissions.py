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


class IsOwnerOrAdmin(permissions.BasePermission):
    """
    Object-level permission to only allow owners of an object or admins to edit it.
    """
    def has_object_permission(self, request, view, obj):
        # Admin or super admin can do anything
        if request.user.is_admin:
            return True
            
        # If the object has the 'uploaded_by' attribute, check if the user is the owner
        if hasattr(obj, 'uploaded_by'):
            return obj.uploaded_by == request.user
            
        # Otherwise, deny permission
        return False 