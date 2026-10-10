from django.contrib import admin

from .models import Chat, Document, Invitation, Membership, Organization, Tag, UsageEvent, User


@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = ("email", "first_name", "last_name", "role", "date_joined")
    list_filter = ("role",)
    search_fields = ("email", "first_name", "last_name")


@admin.register(Organization)
class OrganizationAdmin(admin.ModelAdmin):
    list_display = ("name", "slug", "ai_provider", "ai_api_key_last4", "ollama_allowed", "created_at")
    search_fields = ("name", "slug")
    # The key is ciphertext and only ever set through the app (Settings → AI provider)
    exclude = ("ai_api_key",)
    readonly_fields = ("ai_api_key_last4",)


@admin.register(Membership)
class MembershipAdmin(admin.ModelAdmin):
    list_display = ("user", "organization", "role", "created_at")
    list_filter = ("role", "organization")
    search_fields = ("user__email", "organization__name")


@admin.register(Invitation)
class InvitationAdmin(admin.ModelAdmin):
    list_display = ("email", "organization", "role", "created_at", "expires_at", "accepted_at")
    list_filter = ("organization",)
    exclude = ("token_hash",)


@admin.register(Document)
class DocumentAdmin(admin.ModelAdmin):
    list_display = ("id", "title", "organization", "reference_number", "year", "status", "is_failed", "is_private", "created_at")
    list_filter = ("organization", "status", "is_failed", "is_private")
    search_fields = ("title", "file_name", "reference_number")


admin.site.register(Tag)
admin.site.register(Chat)
admin.site.register(UsageEvent)
