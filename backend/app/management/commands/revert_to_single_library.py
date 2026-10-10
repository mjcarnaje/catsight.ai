"""Undo the organization migrations so the thesis edition can run on this database again.

    python manage.py revert_to_single_library [--dry-run]

The thesis edition (branch thesis-revision) has one shared library and no
organizations. Run this with the general code still deployed, then deploy the thesis
branch (scripts/catsight-remote deploy thesis does both). It migrates `app` back to
0021: organizations, memberships, invitations and each organization's AI settings are
dropped; documents, passages, tags, users and chats stay.

It refuses when there is more than one organization: their libraries would merge
into one, and private documents of one would show up for everyone. Restore the
backup taken before switching to the general edition instead.
"""
from django.core.management import call_command
from django.core.management.base import BaseCommand, CommandError
from django.db.migrations.recorder import MigrationRecorder

from app.models import Organization

THESIS_MIGRATION = "0021_remove_google_sign_in"


def blockers() -> list[str]:
    """Why this database can't go back to a single library; empty when it can."""
    count = Organization.objects.count()
    if count > 1:
        names = ", ".join(Organization.objects.order_by("id").values_list("slug", flat=True)[:10])
        return [f"There are {count} organizations ({names}); their libraries would merge into one."]
    return []


class Command(BaseCommand):
    help = "Migrate back to the single-library schema of the thesis edition."

    def add_arguments(self, parser):
        parser.add_argument("--dry-run", action="store_true", help="Only say whether it can be done")

    def handle(self, dry_run, **options):
        applied = MigrationRecorder.Migration.objects.filter(app="app", name__gt=THESIS_MIGRATION).exists()
        if not applied:
            self.stdout.write("Already on the single-library schema.")
            return
        problems = blockers()
        if problems:
            raise CommandError(" ".join(problems) + " Restore the backup taken before switching instead.")
        if dry_run:
            self.stdout.write("The database can go back to a single library.")
            return
        call_command("migrate", "app", THESIS_MIGRATION, interactive=False, verbosity=1)
        self.stdout.write(self.style.SUCCESS("Back on the single-library schema; deploy the thesis branch now."))
