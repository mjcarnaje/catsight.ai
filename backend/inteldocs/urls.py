from django.conf import settings
from django.contrib import admin
from django.urls import include, path, re_path
from django.views.static import serve

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include("app.urls")),
    # Avatars only; documents are served through signed URLs (api/files/...).
    # In production nginx serves this directory directly.
    re_path(r"^media/(?P<path>avatars/.*)$", serve, {"document_root": settings.MEDIA_ROOT}),
]
