from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from .views import auth, chat, documents, overview, search, tags

urlpatterns = [
    # App
    path("health/", overview.health, name="health"),
    path("config/", overview.app_config, name="config"),
    path("dashboard/", overview.dashboard, name="dashboard"),

    # Accounts
    path("auth/register/", auth.register, name="register"),
    path("auth/login/", auth.login, name="login"),
    path("auth/guest/", auth.guest, name="guest"),
    path("auth/token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("auth/me/", auth.MeView.as_view(), name="me"),

    # Documents
    path("documents/", documents.documents, name="documents"),
    path("documents/<int:document_id>/", documents.document_detail, name="document"),
    path("documents/<int:document_id>/text/", documents.document_text, name="document_text"),
    path("documents/<int:document_id>/chunks/", documents.document_chunks, name="document_chunks"),
    path("documents/<int:document_id>/reprocess/", documents.document_reprocess, name="document_reprocess"),
    path("files/<str:token>/", documents.signed_file, name="signed_file"),

    # Search and chat
    path("search/", search.search_documents, name="search"),
    path("search/answer/", search.search_answer, name="search_answer"),
    path("chats/", chat.chats, name="chats"),
    path("chats/stream/", chat.chat_stream, name="chat_stream"),
    path("chats/<int:chat_id>/", chat.chat_detail, name="chat"),
    path("chats/<int:chat_id>/messages/", chat.chat_messages, name="chat_messages"),

    # Tags
    path("tags/", tags.tags, name="tags"),
    path("tags/<int:tag_id>/", tags.tag_detail, name="tag"),
]
