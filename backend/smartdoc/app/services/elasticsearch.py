import logging
from elasticsearch import Elasticsearch
from django.conf import settings
from django.core.exceptions import ImproperlyConfigured

logger = logging.getLogger(__name__)

def get_elasticsearch_client():
    url = settings.ELASTICSEARCH_URL
    
    if not all([url, settings.ELASTICSEARCH_USERNAME, settings.ELASTICSEARCH_PASSWORD]):
        raise ImproperlyConfigured("Elasticsearch configuration settings are missing.")

    logger.info(f"Attempting to connect to Elasticsearch at {url}")
    
    try:
        es = Elasticsearch(
            [url],
            basic_auth=(settings.ELASTICSEARCH_USERNAME, settings.ELASTICSEARCH_PASSWORD),
            verify_certs=False,
        )
        if not es.ping():
            logger.error("Failed to connect to Elasticsearch")
            raise ValueError("Connection to Elasticsearch failed")
        logger.info("Successfully connected to Elasticsearch")
        return es
    except Exception as e:
        logger.error(f"An error occurred while connecting to Elasticsearch: {e}")
        raise
