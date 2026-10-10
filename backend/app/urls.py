from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from .views import admin_orgs, ai_settings, auth, chat, documents, organization, overview, search, tags

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

    # The request's organization (X-Organization): settings, members, invitations, AI provider
    path("organization/", organization.organization_detail, name="organization"),
    path("organization/members/", organization.members, name="organization_members"),
    path("organization/members/<int:membership_id>/", organization.member_detail, name="organization_member"),
    path("organization/invitations/", organization.invitations, name="organization_invitations"),
    path("organization/invitations/<int:invitation_id>/", organization.invitation_detail, name="organization_invitation"),
    path(
        "organization/invitations/<int:invitation_id>/resend/",
        organization.invitation_resend,
        name="organization_invitation_resend",
    ),
    path("organization/ai/", ai_settings.ai_settings, name="organization_ai"),

    # Invitation links (the token is the credential)
    path("invitations/<str:token>/", organization.invitation_preview, name="invitation_preview"),
    path("invitations/<str:token>/accept/", organization.invitation_accept, name="invitation_accept"),

    # Platform administration (super admin)
    path("admin/organizations/", admin_orgs.organizations, name="admin_organizations"),
    path("admin/organizations/<int:organization_id>/", admin_orgs.organization_detail, name="admin_organization"),
]
