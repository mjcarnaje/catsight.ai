"""Add every PDF under a folder to an organization's library, as one of its admins.

    python manage.py ingest /path/to/pdfs --org acme [--extractor vision] [--email admin@acme.org] [--dry-run]

Duplicates (same bytes) are skipped, so re-running it is safe. Processing uses the
organization's AI provider and key.
"""
from pathlib import Path

from django.core.files import File
from django.core.management.base import BaseCommand, CommandError

from app.constant import OrgRole
from app.models import Membership, Organization
from app.services import extraction, library, llm


class Command(BaseCommand):
    help = "Add every PDF under a folder to an organization's library (as one of its admins)."

    def add_arguments(self, parser):
        parser.add_argument("folder", type=Path)
        parser.add_argument("--org", required=True, help="The organization's slug")
        parser.add_argument("--extractor", help="Default: the organization's default extractor")
        parser.add_argument("--email", help="Admin to upload as (default: the organization's first admin)")
        parser.add_argument("--dry-run", action="store_true", help="Only list what would be added")

    def handle(self, folder: Path, org: str, extractor: str | None, email: str | None, dry_run: bool, **options):
        if not folder.is_dir():
            raise CommandError(f"{folder} is not a folder")
        organization = Organization.objects.filter(slug=org).first()
        if organization is None:
            raise CommandError(f"No organization with the slug {org!r}")
        try:
            cfg = llm.settings_for(organization)
        except llm.AINotConfigured as e:
            raise CommandError(str(e))
        extractor = extractor or extraction.default_extractor(cfg)
        if extractor not in extraction.available_extractors(cfg):
            raise CommandError(f"Extractor {extractor!r} isn't available; options: {extraction.available_extractors(cfg)}")
        admins = Membership.objects.filter(organization=organization, role=OrgRole.ADMIN.value).select_related(
            "user", "organization"
        )
        admin = (admins.filter(user__email=email.lower()) if email else admins).order_by("created_at", "id").first()
        if admin is None:
            raise CommandError(f"{organization.name} has no admin{f' {email}' if email else ''}; add one first.")

        pdfs = sorted(p for p in folder.rglob("*") if p.is_file() and p.suffix.lower() == ".pdf")
        self.stdout.write(f"Found {len(pdfs)} PDFs under {folder}")
        counts: dict[str, int] = {}
        for path in pdfs:
            if dry_run:
                self.stdout.write(f"  would add {path.relative_to(folder)}")
                continue
            with open(path, "rb") as handle:
                result = library.add_document(admin, File(handle, name=path.name), path.name, extractor, private=False)
            counts[result["status"]] = counts.get(result["status"], 0) + 1
            detail = f" ({result['detail']})" if result.get("detail") else ""
            self.stdout.write(f"  {result['status']:<9} {path.relative_to(folder)}{detail}")
        if counts:
            self.stdout.write(self.style.SUCCESS(", ".join(f"{n} {status}" for status, n in sorted(counts.items()))))
