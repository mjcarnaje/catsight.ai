"""Who may do what.

Organization-scoped views use InOrganization (or a subclass): it resolves the
request's membership (services/organizations.py) and sets `request.membership`
and `request.organization` for the view. Every query a view makes for
organization data must go through them.
"""
from rest_framework import permissions
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import AllowAny, IsAuthenticated  # noqa: F401  (re-exported for views)

from ..services import organizations


class InOrganization(permissions.BasePermission):
    """Signed in and a member of the request's organization (any role)."""

    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        if getattr(request, "membership", None) is None:
            try:
                membership = organizations.resolve(request)
            except organizations.OrganizationRequired as e:
                raise PermissionDenied({"detail": e.message, "code": e.code})
            request.membership = membership
            request.organization = membership.organization
        return True


class IsOrgContributor(InOrganization):
    """Members and admins: guests may only read, search and ask."""

    message = "Guests can search and ask, but not change the library."

    def has_permission(self, request, view):
        return super().has_permission(request, view) and not request.membership.is_guest


class IsOrgAdmin(InOrganization):
    message = "Only an organization admin can do this."

    def has_permission(self, request, view):
        return super().has_permission(request, view) and request.membership.is_admin


class IsOrgAdminOrReadOnly(InOrganization):
    """Any member may read; only organization admins may write."""

    message = "Only an organization admin can change this."

    def has_permission(self, request, view):
        if not super().has_permission(request, view):
            return False
        return request.method in permissions.SAFE_METHODS or request.membership.is_admin


class IsSuperAdmin(permissions.BasePermission):
    """The platform's super admin: manages organizations, not their data."""

    message = "Only the super admin can do this."

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.is_super_admin)


def can_modify(membership, document) -> bool:
    """Org admins may change any of the organization's documents; members only their own uploads."""
    if membership is None or document.organization_id != membership.organization_id:
        return False
    if membership.is_admin:
        return True
    return not membership.is_guest and document.uploaded_by_id == membership.user_id
