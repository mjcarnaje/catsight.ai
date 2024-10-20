# tasks.py

import os
import logging
from celery import shared_task
from django.conf import settings
from ocrmypdf import ocr
from elasticsearch.helpers import bulk
from langchain_ollama import OllamaEmbeddings

from ..models import Document, DocumentChunk
from ..utils.doc_text_extractor import DocTextExtractor
from ..utils.doc_processor import DocumentProcessor
from ..services.elasticsearch import get_elasticsearch_client

logger = logging.getLogger(__name__)

@shared_task(bind=True)
def ocr_doc_task(self, doc_id):
    """
    Celery task to perform OCR on a document.
    
    Args:
        doc_id (int): The ID of the Document model to process.
    """
    doc_instance = Document.objects.get(id=doc_id)

    doc_instance.status = "ocr_processing"
    doc_instance.save()
    
    input_path = doc_instance.file

    try:
        if not os.path.exists(input_path):
            raise FileNotFoundError(f"Input file not found: {input_path}")

        output_path = os.path.join(settings.MEDIA_ROOT, 'docs', str(doc_id), f"{doc_id}_ocr.pdf")

        # Save the OCR file automatically, when the file is saved, the file path will be saved in the model
        ocr(input_path, output_path, progress_bar=False, skip_text=True)

        doc_instance.ocr_file = output_path
        doc_instance.status = "text_extracted"
        doc_instance.save()
        logger.info(f"OCR completed successfully for document: {doc_instance.id}")

    except Exception as e:
        doc_instance.status = "failed"
        doc_instance.save()
        logger.error(f"OCR failed for document {doc_id}: {str(e)}")
        raise self.retry(exc=e, countdown=60, max_retries=3)

    return doc_instance.id


@shared_task(bind=True)
def embed_text_task_with_es(self, doc_id, texts):
    es = get_elasticsearch_client()
    index_name = "documents"
    
    model = OllamaEmbeddings(model="llama3.2")

    actions = [
        {
            "_index": index_name,
            "_id": f"{doc_id}_{index}",
            "_source": {
                "text": text,
                "embedding": model.embed_documents([text])[0]
            }
        }
        for index, text in enumerate(texts)
    ]

    # Perform bulk indexing
    try:
        success, failed = bulk(es, actions, raise_on_error=False)
        logger.info(f"Indexed {success} documents, {len(failed)} failed")
        if failed:
            logger.error(f"Failed documents: {failed}")
    except Exception as e:
        logger.error(f"Bulk indexing failed: {str(e)}")
        raise self.retry(exc=e, countdown=60, max_retries=3)

@shared_task(bind=True)
def embed_text_task(self, doc_id):
    doc_instance = Document.objects.get(id=doc_id)

    doc_instance.status = "embedding_text"
    doc_instance.save()

    chunks = DocumentChunk.objects.filter(document__id=doc_id)

    chunks_content = [chunk.content for chunk in chunks]

    model = OllamaEmbeddings(model="llama3.2")
    embeddings = model.embed_documents(chunks_content)  # This returns List[List[float]]

    for chunk, embedding in zip(chunks, embeddings):
        chunk.embedding_vector = embedding  # Directly assign the list of floats

    DocumentChunk.objects.bulk_update(chunks, ['embedding_vector'])

    doc_instance.status = "completed"
    doc_instance.save()

    return doc_id

@shared_task(bind=True)
def save_chunks_to_db(self, doc_id):
    doc_instance = Document.objects.get(id=doc_id)

    doc_instance.status = "text_extracting"
    doc_instance.save()

    if not doc_instance.ocr_file:
        logger.error(f"OCR file not found for Document: {doc_instance.id}")
        doc_instance.status = "failed"
        doc_instance.save()
        return
    
    with open(doc_instance.ocr_file, 'rb') as file:
        file_content = file.read()
    extracted_texts, _ = DocTextExtractor.extract_text_from_doc(file_content=file_content, max_words_per_chunk=500)

    for index, text in enumerate(extracted_texts):
        DocumentChunk.objects.create(document=doc_instance, content=text, index=index)

    return doc_instance.id

@shared_task(bind=True)
def generate_summary_task(self, doc_id):
    doc_instance = Document.objects.get(id=doc_id)

    doc_instance.status = "summary_generating"
    doc_instance.save()

    try:
        first_chunk = DocumentChunk.objects.filter(document=doc_instance).first()

        description = DocumentProcessor.generate_summary(first_chunk.content)
        title = DocumentProcessor.generate_title(description)

        doc_instance.description = description
        doc_instance.title = title
        doc_instance.save()

        logger.info(f"Description and title generated for Document: {doc_instance.id}")
    except Exception as e:
        doc_instance.status = "failed"
        doc_instance.save()
        logger.error(f"Text processing failed for Document {doc_id}: {str(e)}")
        raise self.retry(exc=e, countdown=60, max_retries=3)

    return doc_instance.id
