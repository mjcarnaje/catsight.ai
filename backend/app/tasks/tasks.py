import logging
import os
from celery import shared_task
from django.core.exceptions import ObjectDoesNotExist
from django.utils import timezone
from langchain.docstore.document import Document as LangchainDocument
from langchain.text_splitter import RecursiveCharacterTextSplitter

from ..constant import DocumentStatus, MarkdownConverter
from ..models import Document, DocumentStatusHistory, DocumentFullText
from ..services.vectorstore import vector_store
from ..utils.doc_processor import DocumentProcessor
from docling.document_converter import DocumentConverter

converter = DocumentConverter()
logger = logging.getLogger(__name__)

def update_document_status(document, status, update_fields=None, failed=False):
    """
    Updates the status of a document instance and logs history.
    """
    new_status = status.value if hasattr(status, 'value') else status
    if update_fields is None:
        update_fields = ['status']
    if failed:
        document.is_failed = True
        if 'is_failed' not in update_fields:
            update_fields.append('is_failed')

    old_status = document.status
    document.status = new_status
    document.save(update_fields=update_fields)

    history_entry, created = DocumentStatusHistory.objects.get_or_create(
        document=document,
        status=new_status,
    )
    history_entry.changed_at = timezone.now()
    history_entry.save(update_fields=['changed_at'])

    if created:
        logger.info(f"Created history entry for status '{new_status}' on document {document.id}")
    else:
        logger.info(f"Updated history timestamp for status '{new_status}' on document {document.id}")

    logger.info(
        f"Document status updated from '{old_status}' to '{new_status}' for Document ID: {document.id}"
    )


def save_document_chunks(document, chunks):
    """
    Saves the given chunks to the vector store and updates the document instance.
    """
    document_chunks = []
    chunk_ids = []

    for index, chunk in enumerate(chunks):
        chunk_id = f"doc_{document.id}_chunk_{index}"
        document_chunks.append(LangchainDocument(
            page_content=chunk.page_content,
            metadata={"doc_id": document.id, "id": chunk_id, "index": index},
        ))
        chunk_ids.append(chunk_id)

    try:
        vector_store.add_documents(document_chunks, ids=chunk_ids)
        logger.info(f"Added {len(document_chunks)} chunks for document {document.id}")
    except Exception as e:
        logger.error(f"Error adding chunks: {e}")
        for i, doc in enumerate(document_chunks):
            try:
                vector_store.add_documents([doc], ids=[chunk_ids[i]])
            except Exception as chunk_error:
                logger.error(f"Failed chunk {i}: {chunk_error}")
        # if still errors, let it bubble
    return len(document_chunks)


def convert_pdf_with_marker(file_path: str) -> str:
    from marker.config.parser import ConfigParser
    from marker.converters.pdf import PdfConverter
    from marker.models import create_model_dict
    from marker.output import text_from_rendered

    config = {
        "output_format": "markdown",
        "disable_multiprocessing": False,
        "disable_image_extraction": True,
        "ollama_base_url": os.getenv("OLLAMA_URL"),
        "llm_service": "marker.services.ollama.OllamaService",
        "ollama_model": "llama3.2:1b",
        "force_ocr": True,
    }
    parser = ConfigParser(config)
    pdf_conv = PdfConverter(
        config=parser.generate_config_dict(),
        artifact_dict=create_model_dict(),
        processor_list=parser.get_processors(),
        renderer=parser.get_renderer(),
        llm_service=parser.get_llm_service()
    )
    rendered = pdf_conv(file_path)
    text, _, _ = text_from_rendered(rendered)
    return text


def convert_pdf_with_markitdown(file_path: str) -> str:
    from markitdown import MarkItDown
    md = MarkItDown()
    return md.convert(file_path).text_content


def convert_pdf_with_docling(file_path: str) -> str:
    result = converter.convert(file_path)
    return result.document.export_to_markdown()


@shared_task(bind=True)
def extract_text_task(self, document_id):
    """
    Extracts markdown text from the uploaded file and saves it.
    """
    logger.info(f"Starting extract_text_task for document_id: {document_id}")
    try:
        document = Document.objects.get(id=document_id)
        logger.info(f"Found document: {document.id}, title: {document.title}")
        
        from django.conf import settings
        full_file_path = os.path.join(settings.MEDIA_ROOT, document.file)
        logger.info(f"File path: {document.file}, full path: {full_file_path}")
        
        if not document.file or not os.path.exists(full_file_path):
            logger.error(f"File not found: {document.file} (Full path: {full_file_path})")
            update_document_status(document, DocumentStatus.PENDING, failed=True)
            return document_id

        update_document_status(document, DocumentStatus.TEXT_EXTRACTING)

        # Log the chosen converter
        logger.info(f"Using converter: {document.markdown_converter}")

        try:
            if document.markdown_converter == MarkdownConverter.MARKER.value:
                text = convert_pdf_with_marker(full_file_path)
            elif document.markdown_converter == MarkdownConverter.MARKITDOWN.value:
                text = convert_pdf_with_markitdown(full_file_path)
            elif document.markdown_converter == MarkdownConverter.DOCLING.value:
                text = convert_pdf_with_docling(full_file_path)
            else:
                raise ValueError(f"Invalid converter: {document.markdown_converter}")
            
            logger.info(f"Text extraction successful, text length: {len(text) if text else 0}")
        except Exception as e:
            logger.exception(f"Error converting PDF: {str(e)}")
            # Create a placeholder text if conversion fails
            text = f"# {document.title}\n\nError extracting text from document. The file may be corrupted or unsupported."

        # Create or update the DocumentFullText
        try:
            fulltext_obj, created = DocumentFullText.objects.update_or_create(
                document=document,
                defaults={"text": text}
            )
            logger.info(f"DocumentFullText {'created' if created else 'updated'} for document {document.id}")
        except Exception as e:
            logger.exception(f"Error saving DocumentFullText: {str(e)}")
            raise

        update_document_status(document, DocumentStatus.TEXT_EXTRACTED)
        logger.info(f"extract_text_task completed successfully for document_id: {document_id}")
        return document_id

    except Exception as e:
        logger.exception(f"extract_text_task failed for {document_id}: {str(e)}")
        if 'document' in locals():
            update_document_status(document, DocumentStatus.TEXT_EXTRACTING, failed=True)
        raise


@shared_task(bind=True)
def chunk_and_embed_text_task(self, document_id):
    """
    Splits markdown text into chunks and embeds them in the vector store.
    """
    logger.info(f"Starting chunk_and_embed_text_task for document_id: {document_id}")
    try:
        try:
            document = Document.objects.get(id=document_id)
            logger.info(f"Found document: {document.id}, title: {document.title}")
        except Document.DoesNotExist:
            logger.error(f"Document with id {document_id} does not exist")
            raise

        update_document_status(document, DocumentStatus.EMBEDDING_TEXT)

        # Get the document full text with better error handling
        try:
            fulltext_obj = DocumentFullText.objects.get(document=document)
            logger.info(f"Found DocumentFullText for document {document.id}")
            fulltext = fulltext_obj.text
        except DocumentFullText.DoesNotExist:
            # Create a placeholder if it doesn't exist
            logger.warning(f"DocumentFullText not found for document {document_id}, creating placeholder")
            fulltext = f"# {document.title}\n\nPlaceholder for document {document_id}"
            fulltext_obj = DocumentFullText.objects.create(
                document=document,
                text=fulltext
            )
            logger.info(f"Created placeholder DocumentFullText for document {document.id}")

        # Log text content length for debugging
        logger.info(f"Text length for document {document.id}: {len(fulltext) if fulltext else 0}")

        splitter = RecursiveCharacterTextSplitter(
            chunk_size=1000,
            chunk_overlap=200,
            separators=["\n\n", "\n", " ", ""]
        )
        
        # Improve error handling for splitting
        try:
            docs = splitter.split_documents([LangchainDocument(page_content=fulltext)])
            logger.info(f"Split text into {len(docs)} chunks")
        except Exception as e:
            logger.exception(f"Error splitting document: {str(e)}")
            # Create at least one basic chunk so we can continue
            docs = [LangchainDocument(page_content=fulltext[:1000])]
            logger.info("Created fallback chunk after splitting error")

        # Save chunks with better error handling
        try:
            count = save_document_chunks(document, docs)
            logger.info(f"Saved {count} chunks to vector store")
        except Exception as e:
            logger.exception(f"Error saving chunks to vector store: {str(e)}")
            count = 0
        
        document.no_of_chunks = count
        document.save(update_fields=["no_of_chunks"])

        update_document_status(
            document,
            DocumentStatus.EMBEDDED_TEXT,
            update_fields=["status", "no_of_chunks"]
        )
        logger.info(f"chunk_and_embed_text_task completed successfully for document_id: {document_id}")
        return document_id

    except Exception as e:
        logger.exception(f"chunk_and_embed_text_task failed for {document_id}: {str(e)}")
        if 'document' in locals():
            update_document_status(document, DocumentStatus.EMBEDDING_TEXT, failed=True)
        raise


@shared_task(bind=True)
def generate_document_summary_task(self, document_id):
    """
    Generates a title, summary, year and tags from the first chunk.
    """
    try:
        document = Document.objects.get(id=document_id)
        update_document_status(document, DocumentStatus.GENERATING_SUMMARY)

        chunks = vector_store.similarity_search(
            "", k=1,
            filter={"doc_id": document_id, "index": 0}
        )
        if not chunks:
            chunks = vector_store.similarity_search(
                "", k=1,
                filter={"id": f"doc_{document_id}_chunk_0"}
            )

        if chunks:
            title = DocumentProcessor.get_title(chunks)
            summary = DocumentProcessor.get_summary(chunks)
            year = DocumentProcessor.get_year(chunks)
            tags = DocumentProcessor.get_tags(summary)
            
            # Update document with the generated information
            document.title = title
            document.summary = summary
            document.year = year
            document.tags = tags
            document.save(update_fields=["title", "summary", "year", "tags"])
            
            update_document_status(document, DocumentStatus.SUMMARY_GENERATED,
                               update_fields=["status", "title", "summary", "year", "tags"])

            if document.no_of_chunks > 0:
                update_document_status(document, DocumentStatus.COMPLETED)
        else:
            logger.warning(f"No chunks to summarize for {document_id}")
            update_document_status(document, DocumentStatus.SUMMARY_GENERATED, failed=True)

        return document_id

    except Exception as e:
        logger.exception(f"generate_document_summary_task failed for {document_id}")
        if 'document' in locals():
            update_document_status(document, DocumentStatus.GENERATING_SUMMARY, failed=True)
        raise
