from django.core.management.base import BaseCommand
from app.tasks.tasks import test_vector_search

class Command(BaseCommand):
    help = 'Test vector search'

    def handle(self, *args, **kwargs):
        self.stdout.write('Submitting test vector search task to Celery...')
        task = test_vector_search.delay()
        self.stdout.write(f'Task submitted (id: {task.id})')
        self.stdout.write('Check the logs directory for logging output') 