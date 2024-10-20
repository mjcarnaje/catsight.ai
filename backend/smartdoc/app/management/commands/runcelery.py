from django.core.management.base import BaseCommand
from django.core.management import call_command
import os

class Command(BaseCommand):
    help = 'Run Celery worker'

    def handle(self, *args, **kwargs):
        os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'smartdoc.settings')
        call_command('celery', 'worker', '--pool=gevent', '-l', 'info')
