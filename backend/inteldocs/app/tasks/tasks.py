import logging
from celery import shared_task
from django.core.exceptions import ObjectDoesNotExist
from django.db import transaction
from langchain_ollama import OllamaEmbeddings
from marker.converters.pdf import PdfConverter
from marker.models import create_model_dict
from marker.output import text_from_rendered

from ..models import Document, DocumentChunk
from ..utils.doc_processor import DocumentProcessor
from ..utils.extractor import split_text_into_chunks

logger = logging.getLogger(__name__)

def update_document_status(doc_instance, status, update_fields=None):
    """
    Updates the status of a document instance and optionally other fields.
    """
    if update_fields is None:
        update_fields = ["status"]
    doc_instance.status = status
    doc_instance.save(update_fields=update_fields)
    logger.info(f"Document status updated to '{status}' for Document ID: {doc_instance.id}")

@shared_task(bind=True)
def save_chunks_task(self, doc_id):
    """
    Task to extract text from a PDF document, split it into chunks, and save them.
    This task might take a significant amount of time due to the processing involved.
    """

    import os

    # Set the environment variable for PyTorch MPS high watermark ratio
    os.environ['PYTORCH_MPS_HIGH_WATERMARK_RATIO'] = '0.0' # we do this, because we're running on a server with limited memory

    try:
        logger.info(f"Starting chunk extraction for Document ID: {doc_id}")
        doc_instance = Document.objects.get(id=doc_id)
        logger.debug(f"Document instance retrieved: {doc_instance}")
        update_document_status(doc_instance, "text_extracting")
        logger.debug(f"Document status set to 'text_extracting' for Document ID: {doc_id}")

        # Extract text
        converter = PdfConverter(artifact_dict=create_model_dict())
        logger.debug("PdfConverter initialized.")
        rendered = converter(doc_instance.file)
        logger.debug("Text rendered from PDF.")
        text, _, _ = text_from_rendered(rendered)
        logger.debug("Text extracted from rendered content.")

        logger.info(f"Text: {text}")

        # Split text into chunks
        chunks = split_text_into_chunks(text, chunk_size=1000, chunk_overlap=100)
        logger.debug(f"Text split into {len(chunks)} chunks.")

        # Save chunks
        with transaction.atomic():
            document_chunks = [
                DocumentChunk(document=doc_instance, content=chunk, index=index)
                for index, chunk in enumerate(chunks)
            ]
            DocumentChunk.objects.bulk_create(document_chunks)
            logger.debug(f"{len(document_chunks)} document chunks saved to the database.")

        doc_instance.no_of_chunks = len(chunks)
        update_document_status(doc_instance, "text_extracted", update_fields=["status", "no_of_chunks"])
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
    doc_instance = None
    try:
        with transaction.atomic():
            doc_instance = Document.objects.select_for_update().get(id=doc_id)
            update_document_status(doc_instance, "embedding_text")

            chunks = DocumentChunk.objects.filter(document=doc_instance)
            if not chunks.exists():
                raise ValueError(f"No chunks found for document {doc_id}")

            # Embed document chunks
            model = OllamaEmbeddings(model="bge-m3")
            embeddings = model.embed_documents([chunk.content for chunk in chunks])

            # Update chunks with embeddings
            for chunk, embedding in zip(chunks, embeddings):
                chunk.embedding_vector = embedding
            DocumentChunk.objects.bulk_update(chunks, ["embedding_vector"])

            update_document_status(doc_instance, "completed")
        return doc_id

    except Document.DoesNotExist:
        logger.error(f"Document with ID {doc_id} does not exist.")
        raise
    except Exception as e:
        logger.error(f"Embedding failed for document {doc_id}: {str(e)}")
        if doc_instance:
            update_document_status(doc_instance, "failed")
        raise self.retry(exc=e, countdown=60, max_retries=1)

@shared_task(bind=True)
def generate_summary_task(self, doc_id):
    """
    Task to generate a summary and title for a document based on its first chunk.
    """
    try:
        logger.info(f"Starting summary generation for Document ID: {doc_id}")
        doc_instance = Document.objects.get(id=doc_id)
        update_document_status(doc_instance, "summary_generating")

        first_chunk = DocumentChunk.objects.filter(document=doc_instance).first()
        if first_chunk:
            # Generate summary and title
            description = DocumentProcessor.generate_summary(first_chunk.content)
            title = DocumentProcessor.generate_title(description)
            doc_instance.description = description
            doc_instance.title = title
            update_document_status(doc_instance, "summary_generated", update_fields=["status", "description", "title"])
            logger.info(f"Summary and title generated for Document ID: {doc_id}")
        else:
            update_document_status(doc_instance, "no_chunks_found")
            logger.warning(f"No chunks found for Document ID: {doc_id}, cannot generate summary.")

        return doc_instance.id

    except Exception as e:
        if doc_instance:
            update_document_status(doc_instance, "failed")
        logger.error(f"Summary generation failed for Document ID {doc_id}: {str(e)}")
        raise self.retry(exc=e, countdown=60, max_retries=1)
