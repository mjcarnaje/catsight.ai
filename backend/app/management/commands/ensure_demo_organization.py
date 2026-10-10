"""Make sure the demo organization (settings.DEMO_ORG) exists and can answer (idempotent).

    python manage.py ensure_demo_organization [--name "Tamsin Ridge Water Cooperative"] [--preset general]

Creates the organization when it is missing (with the preset's tags), makes the
ADMIN_EMAIL super admin its admin, and, while it has no provider, gives it the
OpenRouter key in the OPENROUTER_API_KEY environment variable. Nothing that already
exists is changed, so running it after every deploy is safe.
"""
import os

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from app.constant import OrgRole, Provider
from app.models import Membership, Organization, User
from app.services import organizations, secrets


class Command(BaseCommand):
    help = "Create the demo organization if needed, with the super admin as admin and the server's OpenRouter key."

    def add_arguments(self, parser):
        parser.add_argument("--name", default="Demo organization", help="Name used when the organization is created")
        parser.add_argument("--preset", default=organizations.DEFAULT_PRESET, choices=list(organizations.TAG_PRESETS))

    def handle(self, name: str, preset: str, **options):
        slug = (settings.DEMO_ORG or "").strip()
        if not slug:
            raise CommandError("Set DEMO_ORG to the demo organization's slug.")

        organization = Organization.objects.filter(slug=slug).first()
        if organization is None:
            organization = organizations.create_organization(name, slug=slug, preset=preset)
            if organization.slug != slug:  # create_organization never reuses a slug; DEMO_ORG must match exactly
                raise CommandError(f"Created {organization.slug!r} instead of {slug!r}.")
            self.stdout.write(f"Created the demo organization {organization.name} ({slug}).")

        admin_email = os.environ.get("ADMIN_EMAIL", "").strip().lower()
        admin = User.objects.filter(email__iexact=admin_email).first() if admin_email else None
        if admin is not None:
            membership, created = Membership.objects.get_or_create(
                user=admin, organization=organization, defaults={"role": OrgRole.ADMIN.value}
            )
            if created:
                self.stdout.write(f"{admin.email} is an admin of {organization.name}.")

        key = os.environ.get("OPENROUTER_API_KEY", "").strip()
        if not organization.ai_provider and key:
            organization.ai_provider = Provider.OPENROUTER.value
            organization.ai_api_key = secrets.encrypt(key)
            organization.ai_api_key_last4 = key[-4:] if len(key) >= 8 else ""
            organization.save(update_fields=["ai_provider", "ai_api_key", "ai_api_key_last4", "updated_at"])
            self.stdout.write(f"{organization.name} answers with the server's OpenRouter key.")
        self.stdout.write(self.style.SUCCESS(f"Demo organization ready: {organization.name} ({slug})."))
