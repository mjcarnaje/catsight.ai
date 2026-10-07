"""Re-run part of the pipeline for existing documents.

    python manage.py reindex --all                       # re-embed everything (after changing EMBEDDING_MODEL)
    python manage.py reindex 4 7 --from summarizing      # re-summarize and re-index two documents
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
        parser.add_argument("--from", dest="stage", default="indexing", choices=["extracting", "summarizing", "indexing"])

    def handle(self, ids, all, stage, **options):
        if not ids and not all:
            raise CommandError("Pass document ids or --all")
        documents = Document.objects.all() if all else Document.objects.filter(id__in=ids)
        documents = documents.exclude(file="")
        for document in documents:
            reprocess(document, DocumentStatus(stage))
        self.stdout.write(self.style.SUCCESS(f"Queued {documents.count()} documents from {stage}"))
