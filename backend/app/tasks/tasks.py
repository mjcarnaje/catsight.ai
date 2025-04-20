import logging
import os
from typing import List, Tuple

from celery import shared_task
from django.core.exceptions import ObjectDoesNotExist
from langgraph.graph import START, StateGraph
from langchain import hub
from langchain.docstore.document import Document as LangchainDocument
from langchain.text_splitter import RecursiveCharacterTextSplitter
from typing_extensions import TypedDict
from django.utils import timezone

from ..constant import DocumentStatus, MarkdownConverter
from ..models import Document, DocumentStatusHistory
from ..services.ollama import OLLAMA_CHAT
from ..services.vectorstore import vector_store
from ..utils.doc_processor import DocumentProcessor

logger = logging.getLogger(__name__)


def update_document_status(document, status, update_fields=None, failed=False):
    """
    Updates the status of a document instance and optionally other fields.
    Also updates the timestamp of the corresponding status history record.

    Args:
        document: The Document instance to update
        status:    The new status to set (either a DocumentStatus enum or raw string)
        update_fields: List of Document fields to save (defaults to ['status'])
        failed:    If True, mark the document as failed (sets is_failed=True)
    """
    # Normalize status to a string
    new_status = status.value if hasattr(status, 'value') else status

    # Prepare fields to save
    if update_fields is None:
        update_fields = ['status']
    if failed:
        document.is_failed = True
        if 'is_failed' not in update_fields:
            update_fields.append('is_failed')

    old_status = document.status
    document.status = new_status
    document.save(update_fields=update_fields)

    # Ensure we have exactly one history entry, then update its timestamp
    history_entry, created = DocumentStatusHistory.objects.get_or_create(
        document=document,
        status=new_status,
    )
    history_entry.changed_at = timezone.now()
    history_entry.save(update_fields=['changed_at'])

    if created:
        logger.info(
            f"Created history entry for status '{new_status}' "
            f"on document {document.id}"
        )
    else:
        logger.info(
            f"Updated timestamp for status '{new_status}' "
            f"in document {document.id} history"
        )

    logger.info(
        f"Document status updated from '{old_status}' to '{new_status}' "
        f"for Document ID: {document.id}"
    )


def save_document_chunks(document, chunks):
    """
    Saves the given chunks to the vector store and updates the document instance.
    
    Args:
        document: The document instance to update
        chunks: The list of chunks to save
    """
    document_chunks = []
    chunk_ids = []

    for index, chunk in enumerate(chunks):
        # Create a unique ID that's compatible with the vector store
        chunk_id = f"doc_{document.id}_chunk_{index}"
        
        # Add to our document chunks list
        document_chunks.append(LangchainDocument(
            page_content=chunk.page_content,
            metadata={
                "doc_id": document.id, 
                "id": chunk_id, 
                "index": index
            },
        ))
        
        # Store the ID for later use
        chunk_ids.append(chunk_id)
    
    try:
        # Use explicit IDs when adding documents
        vector_store.add_documents(document_chunks, ids=chunk_ids)
        logger.info(f"Successfully added {len(document_chunks)} chunks to vector store for document {document.id}")
    except Exception as e:
        logger.error(f"Error adding chunks to vector store: {str(e)}")
        # If there's an error with the vector store, we can try a different approach
        # This is a fallback mechanism to ensure the document processing can continue
        try:
            # Try adding each chunk individually
            for i, chunk in enumerate(document_chunks):
                try:
                    vector_store.add_documents([chunk], ids=[chunk_ids[i]])
                except Exception as chunk_error:
                    logger.error(f"Error adding chunk {i} for document {document.id}: {str(chunk_error)}")
        except Exception as fallback_error:
            logger.error(f"Fallback method also failed: {str(fallback_error)}")
            # If both methods fail, re-raise the original error
            raise e

    return len(document_chunks)

def convert_pdf_with_marker(file_path: str) -> str:
    """
    Convert PDF to text using Marker library.
    
    Args:
        file_path: Path to the PDF file
        
    Returns:
        Extracted text in markdown format
    """
    # Local imports for lazy loading
    from marker.config.parser import ConfigParser
    from marker.converters.pdf import PdfConverter
    from marker.models import create_model_dict
    from marker.output import text_from_rendered

    os.environ['PYTORCH_MPS_HIGH_WATERMARK_RATIO'] = '0.0'

    config = {
        "output_format": "markdown",
        "disable_multiprocessing": False,
        "disable_image_extraction": True,
    }
    config_parser = ConfigParser(config)

    pdf_converter = PdfConverter(
        config=config_parser.generate_config_dict(),
        artifact_dict=create_model_dict(),
        processor_list=config_parser.get_processors(),
        renderer=config_parser.get_renderer()
    )
    rendered = pdf_converter(file_path)
    text, _, _ = text_from_rendered(rendered)
    return text


def convert_pdf_with_markitdown(file_path: str) -> str:
    """
    Convert PDF to text using MarkItDown library.
    
    Args:
        file_path: Path to the PDF file
        
    Returns:
        Extracted text content
    """
    from markitdown import MarkItDown
    md = MarkItDown()
    md_result = md.convert(file_path)
    return md_result.text_content


@shared_task(bind=True)
def process_document_chunks_task(self, document_id):
    """
    Task to extract text from a PDF document, split it into chunks, and save them.
    
    Args:
        document_id: ID of the document to process
    """
    logger.info("Starting chunk extraction for Document ID: %s", document_id)

    try:
        document = Document.objects.get(id=document_id)
        
        # Validate document file exists
        if not document.file or not os.path.exists(document.file):
            logger.error(f"Document file not found: {document.file}")
            update_document_status(document, DocumentStatus.TEXT_EXTRACTING, failed=True)
            return document.id
            
        update_document_status(document, DocumentStatus.TEXT_EXTRACTING, update_fields=["status"])

        try:
            if document.markdown_converter == MarkdownConverter.MARKER.value:
                text = convert_pdf_with_marker(document.file)
            elif document.markdown_converter == MarkdownConverter.MARKITDOWN.value:
                text = convert_pdf_with_markitdown(document.file)
            else:
                raise ValueError(
                    f"Invalid markdown converter: {document.markdown_converter}"
                )
        except Exception as e:
            logger.error(f"Error extracting text from document {document_id}: {str(e)}")
            update_document_status(document, DocumentStatus.TEXT_EXTRACTING, failed=True)
            raise
        
        update_document_status(document, DocumentStatus.TEXT_EXTRACTED, update_fields=["status"])
        update_document_status(document, DocumentStatus.EMBEDDING_TEXT, update_fields=["status"])
        
        # Split text into chunks
        try:
            text_splitter = RecursiveCharacterTextSplitter(
                chunk_size=1000,
                chunk_overlap=200,
                separators=["\n\n", "\n", " ", ""]
            )
            chunks = text_splitter.split_documents([LangchainDocument(page_content=text)])
        except Exception as e:
            logger.error(f"Error splitting text into chunks for document {document_id}: {str(e)}")
            update_document_status(document, DocumentStatus.EMBEDDING_TEXT, failed=True)
            raise
            
        # Save chunks to vector store
        try:
            document.no_of_chunks = save_document_chunks(document, chunks)
            update_document_status(document, DocumentStatus.EMBEDDED_TEXT, update_fields=["status", "no_of_chunks"])
        except Exception as e:
            logger.error(f"Error saving chunks for document {document_id}: {str(e)}")
            update_document_status(document, DocumentStatus.EMBEDDING_TEXT, failed=True)
            raise

        logger.info("Successfully processed and saved chunks for Document ID: %s", document_id)
        return document.id

    except ObjectDoesNotExist as e:
        logger.error("Document with ID %s does not exist. Error: %s", document_id, str(e))
        raise

    except Exception as e:
        logger.error("Error processing document ID %s: %s", document_id, str(e))
        # If document exists, mark it as failed with the right status
        if 'document' in locals():
            current_status = getattr(document, 'status', None)
            if current_status == DocumentStatus.TEXT_EXTRACTING.value:
                update_document_status(document, DocumentStatus.TEXT_EXTRACTING, failed=True)
            elif current_status == DocumentStatus.TEXT_EXTRACTED.value:
                update_document_status(document, DocumentStatus.TEXT_EXTRACTED, failed=True)
            elif current_status == DocumentStatus.EMBEDDING_TEXT.value:
                update_document_status(document, DocumentStatus.EMBEDDING_TEXT, failed=True)
            else:
                update_document_status(document, DocumentStatus.PENDING, failed=True)
        raise


@shared_task(bind=True)
def generate_document_summary_task(self, document_id):
    """
    Task to generate a summary and title for a document based on its first chunk.
    
    Args:
        document_id: ID of the document to summarize
    """
    try:
        logger.info(f"Starting summary generation for Document ID: {document_id}")
        document = Document.objects.get(id=document_id)
        update_document_status(document, DocumentStatus.GENERATING_SUMMARY, update_fields=["status"])

        # Try to get chunks using the filter on doc_id and index
        chunks = vector_store.similarity_search(
            "", 
            k=1, 
            filter={"doc_id": document_id, "index": 0}
        )
        
        # If that doesn't work, try using our new ID format
        if not chunks:
            logger.info(f"No chunks found using standard filter, trying with explicit ID format")
            chunks = vector_store.similarity_search(
                "",
                k=1,
                filter={"id": f"doc_{document_id}_chunk_0"}
            )
        
        if chunks:
            first_chunk = chunks[0]
            title, summary = DocumentProcessor.generate_information(first_chunk.page_content)

            document.description = summary
            document.title = title
            update_document_status(document, DocumentStatus.SUMMARY_GENERATED, update_fields=["status", "description", "title"])
            
            # Now that we've processed the document up to SUMMARY_GENERATED
            # we should also update COMPLETED status if we're done with embedding
            if document.no_of_chunks > 0:
                update_document_status(document, DocumentStatus.COMPLETED, update_fields=["status"])

            logger.info(f"Summary and title generated for Document ID: {document_id}")
        else:
            logger.warning(f"No chunks found for Document ID: {document_id}, cannot generate summary.")
            update_document_status(document, DocumentStatus.SUMMARY_GENERATED, failed=True)

        return document.id

    except Exception as e:
        if 'document' in locals():
            update_document_status(document, DocumentStatus.GENERATING_SUMMARY, failed=True)
        logger.error(f"Summary generation failed for Document ID {document_id}: {str(e)}")
        raise self.retry(exc=e, countdown=60, max_retries=1)
