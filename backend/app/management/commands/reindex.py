"""Re-run part of the pipeline for existing documents.

    python manage.py reindex --all [--org acme]          # re-embed everything (or one organization's library)
    python manage.py reindex 4 7 --from summarizing      # re-summarize and re-index two documents
    python manage.py reindex --unfinished                # requeue documents stuck mid-pipeline or failed,
                                                         # each from the stage it stopped at
"""
from django.core.management.base import BaseCommand, CommandError

from app.constant import DocumentStatus
from app.models import Document
from app.tasks.tasks import reprocess


class Command(BaseCommand):
    help = "Queue documents to be re-processed from a pipeline stage."

    def add_arguments(self, parser):
        parser.add_argument("ids", nargs="*", type=int)
        parser.add_argument("--all", action="store_true")
        parser.add_argument("--unfinished", action="store_true", help="Documents that aren't ready, from their own stage")
        parser.add_argument("--from", dest="stage", default="indexing", choices=["extracting", "summarizing", "indexing"])
        parser.add_argument("--org", help="Only this organization's documents (its slug)")

    def handle(self, ids, all, unfinished, stage, org, **options):
        scope = Document.objects.filter(organization__slug=org) if org else Document.objects.all()
        if unfinished:
            documents = scope.exclude(file="").exclude(status=DocumentStatus.READY.value, is_failed=False)
            for document in documents:
                current = DocumentStatus(document.status)
                reprocess(document, DocumentStatus.EXTRACTING if current is DocumentStatus.QUEUED else current)
            self.stdout.write(self.style.SUCCESS(f"Requeued {documents.count()} unfinished documents"))
            return
        if not ids and not all:
            raise CommandError("Pass document ids, --all or --unfinished")
        documents = scope if all else scope.filter(id__in=ids)
        documents = documents.exclude(file="")
        for document in documents:
            reprocess(document, DocumentStatus(stage))
        self.stdout.write(self.style.SUCCESS(f"Queued {documents.count()} documents from {stage}"))
