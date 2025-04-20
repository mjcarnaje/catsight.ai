from __future__ import absolute_import, unicode_literals
import os
from celery import Celery
from django.conf import settings
import logging

# Set the default Django settings module
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'inteldocs.settings')

# Initialize logger for Celery
logger = logging.getLogger('celery')

app = Celery('inteldocs')

# Configure Celery using Django settings
app.config_from_object('django.conf:settings', namespace='CELERY')

# Auto-discover tasks in all installed apps
app.autodiscover_tasks(lambda: settings.INSTALLED_APPS)

@app.task(bind=True)
def debug_task(self):
    logger.info(f'Request: {self.request!r}')

