"""Add every PDF under a folder to the library, as an admin.

    python manage.py ingest /path/to/pdfs [--extractor vision] [--dry-run]

Duplicates (same bytes) are skipped, so re-running it is safe.
"""
from pathlib import Path

from django.conf import settings
from django.core.files import File
from django.core.management.base import BaseCommand, CommandError

from app.models import User
from app.services import extraction, library


class Command(BaseCommand):
    help = "Add every PDF under a folder to the shared library (as the first admin)."

    def add_arguments(self, parser):
        parser.add_argument("folder", type=Path)
        parser.add_argument("--extractor", default=settings.DEFAULT_TEXT_EXTRACTOR)
        parser.add_argument("--email", help="Admin to upload as (default: the first super admin)")
        parser.add_argument("--dry-run", action="store_true", help="Only list what would be added")

    def handle(self, folder: Path, extractor: str, email: str | None, dry_run: bool, **options):
        if not folder.is_dir():
            raise CommandError(f"{folder} is not a folder")
        if extractor not in extraction.available_extractors():
            raise CommandError(f"Extractor {extractor!r} isn't available; options: {extraction.available_extractors()}")
        admins = User.objects.filter(role__in=["super_admin", "admin"]).order_by("id")
        admin = admins.filter(email=email).first() if email else admins.first()
        if admin is None:
            raise CommandError("No admin user found; run `manage.py ensure_admin` first.")

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
