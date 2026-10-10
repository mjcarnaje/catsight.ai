"""Move existing rows into organizations.

A database with documents or chats (e.g. a restored single-library deployment)
gets one "Default organization" holding everything, with every user as a member
(their old role decides the membership role). A fresh database only has the
MSU-IIT tags that 0020 created; tags now come from presets when an organization
is created, so those are dropped. The global "admin" role is gone: organization
admins are memberships.
"""
import os

from django.db import migrations

MEMBERSHIP_ROLE = {"super_admin": "admin", "admin": "admin", "user": "member", "guest": "guest"}
OLD_EMBEDDING_DEFAULTS = {"openrouter": "baai/bge-m3", "ollama": "bge-m3"}


def forwards(apps, schema_editor):
    Organization = apps.get_model("app", "Organization")
    Membership = apps.get_model("app", "Membership")
    Document = apps.get_model("app", "Document")
    Tag = apps.get_model("app", "Tag")
    Chat = apps.get_model("app", "Chat")
    UsageEvent = apps.get_model("app", "UsageEvent")
    User = apps.get_model("app", "User")

    if Document.objects.exists() or Chat.objects.exists():
        org = Organization.objects.create(name="Default organization", slug="default")
        Document.objects.update(organization=org)
        Tag.objects.update(organization=org)
        Chat.objects.update(organization=org)
        UsageEvent.objects.update(organization=org)
        Membership.objects.bulk_create(
            Membership(user=user, organization=org, role=MEMBERSHIP_ROLE.get(user.role, "member"))
            for user in User.objects.all()
        )
        # The stored vectors came from the deployment-wide provider settings of the time
        provider = os.getenv("LLM_PROVIDER", "openrouter").strip().lower() or "openrouter"
        model = os.getenv("EMBEDDING_MODEL") or OLD_EMBEDDING_DEFAULTS.get(provider, "baai/bge-m3")
        Document.objects.filter(chunk_count__gt=0).update(embedding_model=f"{provider}:{model}")
    else:
        Tag.objects.filter(organization__isnull=True).delete()

    User.objects.filter(role="admin").update(role="user")


class Migration(migrations.Migration):
    dependencies = [("app", "0022_organizations")]

    operations = [migrations.RunPython(forwards, migrations.RunPython.noop)]
