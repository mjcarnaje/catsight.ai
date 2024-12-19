import logging

from celery import shared_task
from django.core.exceptions import ObjectDoesNotExist
from django.db import transaction

from ..constant import DocumentStatus
from ..models import Document, DocumentChunk
from ..services.ollama import EMBEDDING_MODEL
from ..utils.doc_processor import DocumentProcessor
from ..utils.extractor import split_text_into_chunks

logger = logging.getLogger(__name__)

def update_document_status(doc_instance, status, update_fields=None, failed=False):
    """
    Updates the status of a document instance and optionally other fields.
    """
    if update_fields is None:
        update_fields = ["status"]
    if failed:
        doc_instance.is_failed = True
        update_fields.append("is_failed")
    doc_instance.status = status.value
    doc_instance.save(update_fields=update_fields)
    logger.info(f"Document status updated to '{status.value}' for Document ID: {doc_instance.id}")


def save_document_chunks(doc_instance, chunks):
    """
    Saves the given chunks to the database and updates the document instance.
    """
    with transaction.atomic():
        document_chunks = [
            DocumentChunk(document=doc_instance, content=chunk, index=index)
            for index, chunk in enumerate(chunks)
        ]
        DocumentChunk.objects.bulk_create(document_chunks)

    doc_instance.no_of_chunks = len(chunks)
    update_document_status(doc_instance, DocumentStatus.TEXT_EXTRACTED, update_fields=["status", "no_of_chunks"])


@shared_task(bind=True)
def save_chunks_task(self, doc_id):
    """
    Task to extract text from a PDF document, split it into chunks, and save them.
    """
    from marker.output import text_from_rendered
    from marker.config.parser import ConfigParser
    from marker.converters.pdf import PdfConverter
    from marker.models import create_model_dict

    import os

    os.environ['PYTORCH_MPS_HIGH_WATERMARK_RATIO'] = '0.0'

    try:
        logger.info(f"Starting chunk extraction for Document ID: {doc_id}")
        doc_instance = Document.objects.get(id=doc_id)
        update_document_status(doc_instance, DocumentStatus.TEXT_EXTRACTING)

        config = {
            "output_format": "markdown",
            "disable_multiprocessing": True,
            "disable_image_extraction": True,
        }
        config_parser = ConfigParser(config)

        pdf_converter = PdfConverter(
            config=config_parser.generate_config_dict(),
            artifact_dict=create_model_dict(),
            processor_list=config_parser.get_processors(),
            renderer=config_parser.get_renderer()
        )

        rendered = pdf_converter(doc_instance.file)
        text, _, _ = text_from_rendered(rendered)

        chunks = split_text_into_chunks(text, chunk_size=1000, chunk_overlap=100)
        save_document_chunks(doc_instance, chunks)

        logger.info(f"Successfully processed and saved chunks for Document ID: {doc_id}")
        return doc_instance.id

    except ObjectDoesNotExist:
        logger.error(f"Document with ID {doc_id} does not exist.")
        raise
    except Exception as e:
        logger.error(f"Error processing document ID {doc_id}: {str(e)}")
        raise


@shared_task(bind=True)
def embed_text_task(self, doc_id):
    """
    Task to embed text chunks using OllamaEmbeddings and update the document.
    """
    try:
        with transaction.atomic():
            doc_instance = Document.objects.select_for_update().get(id=doc_id)
            update_document_status(doc_instance, DocumentStatus.EMBEDDING_TEXT)

            chunks = DocumentChunk.objects.filter(document=doc_instance)
            if not chunks.exists():
                raise ValueError(f"No chunks found for document {doc_id}")

            embeddings = EMBEDDING_MODEL.embed_documents([chunk.content for chunk in chunks])
            for chunk, embedding in zip(chunks, embeddings):
                chunk.embedding_vector = embedding

            DocumentChunk.objects.bulk_update(chunks, ["embedding_vector"])
            update_document_status(doc_instance, DocumentStatus.COMPLETED)

        return doc_id

    except ObjectDoesNotExist:
        logger.error(f"Document with ID {doc_id} does not exist.")
        raise
    except Exception as e:
        logger.error(f"Embedding failed for document {doc_id}: {str(e)}")
        if 'doc_instance' in locals():
            update_document_status(doc_instance, DocumentStatus.EMBEDDING_TEXT, failed=True)
        raise self.retry(exc=e, countdown=60, max_retries=1)


@shared_task(bind=True)
def generate_summary_task(self, doc_id):
    """
    Task to generate a summary and title for a document based on its first chunk.
    """
    try:
        logger.info(f"Starting summary generation for Document ID: {doc_id}")
        doc_instance = Document.objects.get(id=doc_id)
        update_document_status(doc_instance, DocumentStatus.GENERATING_SUMMARY)

        first_chunk = DocumentChunk.objects.filter(document=doc_instance).first()
        if first_chunk:
            description = DocumentProcessor.generate_summary(first_chunk.content)
            title = DocumentProcessor.generate_title(description)

            doc_instance.description = description
            doc_instance.title = title
            update_document_status(doc_instance, DocumentStatus.SUMMARY_GENERATED, update_fields=["status", "description", "title"])

            logger.info(f"Summary and title generated for Document ID: {doc_id}")
        else:
            update_document_status(doc_instance, DocumentStatus.FAILED, failed=True)
            logger.warning(f"No chunks found for Document ID: {doc_id}, cannot generate summary.")

        return doc_instance.id

    except Exception as e:
        if 'doc_instance' in locals():
            update_document_status(doc_instance, DocumentStatus.GENERATING_SUMMARY, failed=True)
        logger.error(f"Summary generation failed for Document ID {doc_id}: {str(e)}")
        raise self.retry(exc=e, countdown=60, max_retries=1)
