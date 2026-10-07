from django.conf import settings
from django.contrib import admin
from django.urls import include, path, re_path
from django.views.static import serve


def avatar(request, name: str):
    # The document root is the avatars directory itself, so no name can reach the
    # documents (they're served through signed URLs: api/files/...).
    return serve(request, name, document_root=settings.MEDIA_ROOT / "avatars")


urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include("app.urls")),
    # Only the names the upload view generates. In production nginx serves these.
    re_path(r"^media/avatars/(?P<name>[0-9a-f]{32}\.webp)$", avatar),
]
