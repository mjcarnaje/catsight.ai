from django.core.management.base import BaseCommand
from ...services.elasticsearch import get_elasticsearch_client

class Command(BaseCommand):
    help = 'Creates the Elasticsearch index for documents'

    def handle(self, *args, **kwargs):
        es = get_elasticsearch_client()

        # Define the mapping
        index_mapping = { 
            "mappings": {
                "properties": {
                    "text": {"type": "text"},
                    "embedding": {"type": "dense_vector", "dims": 3072}
                }
            }
        }

        # Create the index
        index_name = 'documents'

        es.indices.delete(index=index_name, ignore=[400, 404])
        es.indices.create(index=index_name, body=index_mapping)
        print(f"Created index: {index_name}")
        

