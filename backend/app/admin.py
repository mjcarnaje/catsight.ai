from django.contrib import admin

from .models import Chat, Document, Tag, UsageEvent, User


@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = ("email", "first_name", "last_name", "role", "date_joined")
    list_filter = ("role",)
    search_fields = ("email", "first_name", "last_name")


@admin.register(Document)
class DocumentAdmin(admin.ModelAdmin):
    list_display = ("id", "title", "reference_number", "year", "status", "is_failed", "is_private", "created_at")
    list_filter = ("status", "is_failed", "is_private", "tags")
    search_fields = ("title", "file_name", "reference_number")


admin.site.register(Tag)
admin.site.register(Chat)
admin.site.register(UsageEvent)
