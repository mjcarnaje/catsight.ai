"""Create an organization from the command line, with its tag preset and an optional admin.

    python manage.py create_organization "MSU-IIT" --slug msu-iit --preset msu-iit [--admin admin@msuiit.edu.ph]

--admin must be an existing user, who becomes the organization's admin. To let someone
else in, invite them instead: the super admin screen can send an admin invitation.
"""
import re

from django.core.management.base import BaseCommand, CommandError

from app.models import Organization, User
from app.services import organizations

# The same rule as the super admin API (views/admin_orgs.py)
SLUG = re.compile(r"[a-z0-9]+(?:-[a-z0-9]+)*")
MAX_SLUG = 50


class Command(BaseCommand):
    help = "Create an organization with its tag preset (and, optionally, an admin)."

    def add_arguments(self, parser):
        parser.add_argument("name", help="The organization's name")
        parser.add_argument("--slug", default="", help="A URL-safe slug (default: derived from the name)")
        parser.add_argument(
            "--preset",
            default=organizations.DEFAULT_PRESET,
            choices=list(organizations.TAG_PRESETS),
            help="The tags the organization starts with",
        )
        parser.add_argument("--admin", help="Email of an existing user to make the organization's admin")

    def handle(self, name: str, slug: str, preset: str, admin: str | None, **options):
        name = name.strip()
        if not 1 <= len(name) <= 200:
            raise CommandError("The name must be 1 to 200 characters.")
        if slug:
            if len(slug) > MAX_SLUG or not SLUG.fullmatch(slug):
                raise CommandError("A slug uses lowercase letters, numbers and single hyphens, up to 50 characters.")
            if Organization.objects.filter(slug=slug).exists():
                raise CommandError(f"The slug {slug!r} is already taken.")
        admin_user = None
        if admin:
            admin_user = User.objects.filter(email__iexact=admin.strip()).first()
            if admin_user is None:
                raise CommandError(f"No user has the email {admin}. Sign them up first.")

        organization = organizations.create_organization(name, slug, preset, admin=admin_user)
        self.stdout.write(
            self.style.SUCCESS(f"Created {organization.name} with the slug {organization.slug} ({preset} tags).")
        )
