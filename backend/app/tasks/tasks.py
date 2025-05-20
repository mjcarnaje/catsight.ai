import logging
import os
import asyncio
from celery import shared_task
from django.utils import timezone
from langchain.docstore.document import Document as Doc
from langchain.text_splitter import RecursiveCharacterTextSplitter
from functools import lru_cache

from ..constant import DocumentStatus, MarkdownConverter
from ..models import Document, DocumentStatusHistory, DocumentFullText
from ..services.vectorstore import vector_store
from ..services.summarization_agent import summarization_agent, summarization_splitter
    
logger = logging.getLogger(__name__)

def update_document_status(document, status, update_fields=None, failed=False):
    """
    Updates the status of a document instance and logs history.
    """
    new_status = status.value if hasattr(status, 'value') else status

    if update_fields is None:
        update_fields = ["status"]  
    else:
        update_fields.append("status")

    if failed:
        document.is_failed = True
        if 'is_failed' not in update_fields:
            update_fields.append('is_failed')
    
    # remove duplicates
    update_fields = list(set(update_fields))

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

def save_document_chunks(document, docs):
    try:
        vector_store.add_documents(docs)
        logger.info(f"Added {len(docs)} chunks for document {document.id}")
    except Exception as e:
        logger.error(f"Error adding chunks: {e}")
    
    return len(docs)

@lru_cache(maxsize=1)
def get_marker_converter():
    from marker.config.parser import ConfigParser
    from marker.converters.pdf import PdfConverter
    from marker.models import create_model_dict
    
    marker_config = {
        "output_format": "markdown",
        "disable_multiprocessing": False,
        "disable_image_extraction": True,
        "ollama_base_url": os.getenv("OLLAMA_URL"),
        "llm_service": "marker.services.ollama.OllamaService",
        "ollama_model": "qwen2.5:7b-instruct-q4_K_M",
        "force_ocr": True,
        "strip_existing_ocr": True,
        "use_llm": False,
        "debug": False,
        "paginate_output": True,
        "format_lines": True
    }
    marker_parser = ConfigParser(marker_config)
    return PdfConverter(
        config=marker_parser.generate_config_dict(),
        artifact_dict=create_model_dict(),
        processor_list=marker_parser.get_processors(),
        renderer=marker_parser.get_renderer(),
        llm_service=marker_parser.get_llm_service()
    )

def convert_pdf_with_marker(file_path: str) -> str:
    from marker.output import text_from_rendered
    
    marker_pdf_converter = get_marker_converter()
    rendered = marker_pdf_converter(file_path)
    text, _, _ = text_from_rendered(rendered)
    return text

@lru_cache(maxsize=1)
def get_markitdown_converter():
    from markitdown import MarkItDown
    return MarkItDown()

def convert_pdf_with_markitdown(file_path: str) -> str:
    markitdown_converter = get_markitdown_converter()
    return markitdown_converter.convert(file_path).text_content

@lru_cache(maxsize=1)
def get_docling_converter():
    from docling.document_converter import DocumentConverter
    return DocumentConverter()

def convert_pdf_with_docling(file_path: str) -> str:
    docling_converter = get_docling_converter()
    result = docling_converter.convert(file_path)
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

        try:
            if document.markdown_converter == MarkdownConverter.MARKER.value:
                try:
                    text = convert_pdf_with_marker(full_file_path)
                except Exception as e:
                    logger.exception(f"Error converting PDF with Marker: {str(e)}")
                    text = f"# {document.title}\n\nError extracting text from document using Marker. The file may be corrupted or unsupported."
            elif document.markdown_converter == MarkdownConverter.MARKITDOWN.value:
                try:
                    text = convert_pdf_with_markitdown(full_file_path)
                except Exception as e:
                    logger.exception(f"Error converting PDF with MarkItDown: {str(e)}")
                    text = f"# {document.title}\n\nError extracting text from document using MarkItDown. The file may be corrupted or unsupported."
            elif document.markdown_converter == MarkdownConverter.DOCLING.value:
                try:
                    text = convert_pdf_with_docling(full_file_path)
                except Exception as e:
                    logger.exception(f"Error converting PDF with DocLing: {str(e)}")
                    text = f"# {document.title}\n\nError extracting text from document using DocLing. The file may be corrupted or unsupported."
            else:
                raise ValueError(f"Invalid converter: {document.markdown_converter}")
            
            logger.info(f"Text extraction successful, text length: {len(text) if text else 0}")
        except Exception as e:
            logger.exception(f"Error converting PDF: {str(e)}")
            text = f"# {document.title}\n\nError extracting text from document. The file may be corrupted or unsupported."

        try:
            DocumentFullText.objects.update_or_create(
                document=document,
                defaults={"text": text}
            )
        except Exception as e:
            logger.exception(f"Error saving DocumentFullText: {str(e)}")
            raise

        update_document_status(document, DocumentStatus.TEXT_EXTRACTION_DONE)
        
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

        try:
            fulltext_obj = DocumentFullText.objects.get(document=document)
            logger.info(f"Found DocumentFullText for document {document.id}")
            fulltext = fulltext_obj.text
        except DocumentFullText.DoesNotExist:
            logger.warning(f"DocumentFullText not found for document {document_id}, creating placeholder")
            fulltext = f"# {document.title}\n\nPlaceholder for document {document_id}"
            fulltext_obj = DocumentFullText.objects.create(
                document=document,
                text=fulltext
            )
            logger.info(f"Created placeholder DocumentFullText for document {document.id}")

        logger.info(f"Text length for document {document.id}: {len(fulltext) if fulltext else 0}")

        chunk_size = 1000
        chunk_overlap = 100
        
        # markdown_splitter = MarkdownHeaderTextSplitter(
        #     headers_to_split_on=[("#", "Header 1"), ("##", "Header 2"), ("###", "Header 3")],
        #     strip_headers=False,
        # )
        
        # md_header_splits = markdown_splitter.split_text(fulltext)
        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=chunk_size, 
            chunk_overlap=chunk_overlap, 
            separators=[
                "\n\n",
                "\n",
                " ",
                ".",
                ",",
                "\u200b",  # Zero-width space
                "\uff0c",  # Fullwidth comma
                "\u3001",  # Ideographic comma
                "\uff0e",  # Fullwidth full stop
                "\u3002",  # Ideographic full stop
                "",
            ],
        )
        splits = text_splitter.split_text(fulltext)
        logger.info(f"Split text into {len(splits)} chunks")

        docs = []

        for i, chunk in enumerate(splits):
            metadata = {
                "doc_id": document.id,
                "id": f"doc_{document.id}_chunk_{i}",
                "index": i,
                "year": document.year,
                "tags": list(document.tags.values_list("id", flat=True))
            }
            docs.append(Doc(page_content=chunk, metadata=metadata))

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
            DocumentStatus.TEXT_EMBEDDING_DONE,
            update_fields=["status", "no_of_chunks"]
        )
        
        update_document_status(document, DocumentStatus.COMPLETED)
        
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
        fulltext = DocumentFullText.objects.get(document=document).text
        update_document_status(document, DocumentStatus.GENERATING_SUMMARY)

        chunks = summarization_splitter.split_text(fulltext)

        try:
            loop = asyncio.get_event_loop()
        except RuntimeError:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
        
        model_name = document.summarization_model
        logger.info(f"Using model {model_name} for summarization of document {document_id}")
        
        async def process_summarization():
            final_state = None
            async for state in summarization_agent.astream(
                input={"contents": chunks, "model_name": model_name},
                stream_mode="values"
            ):
                final_state = state
            return final_state
        
        final_state = loop.run_until_complete(process_summarization())

        logger.info(f"[TITLE] {final_state['title']}")
        logger.info(f"[SUMMARY] {final_state['final_summary']}")
        logger.info(f"[YEAR] {final_state['year']}")
        logger.info(f"[TAGS] {final_state['tags']}")
        
        document.title = final_state["title"]
        document.summary = final_state["final_summary"]
        document.year = final_state["year"]
        document.tags.set(final_state["tags"])
        
        document.save(update_fields=["title", "summary", "year"])
        
        update_document_status(document, DocumentStatus.SUMMARY_GENERATION_DONE,
                            update_fields=["status", "title", "summary", "year"])

        return document_id

    except Exception as e:
        logger.exception(f"generate_document_summary_task failed for {document_id}")
        if 'document' in locals():
            update_document_status(document, DocumentStatus.GENERATING_SUMMARY, failed=True)
        raise

@shared_task(bind=True)
def process_document_task(self, document_id):
    """
    Process a document completely: extract text, chunk and embed, generate summary.
    This combines the three separate tasks into a single workflow.
    
    The function is smart enough to check the document's current status and skip steps
    that have already been completed.
    """
    logger.info(f"Starting complete document processing for document_id: {document_id}")

    try:
        document = Document.objects.get(id=document_id)
        update_document_status(document, DocumentStatus.PROCESSING)
        
        current_status = document.status
        logger.info(f"Document {document_id} current status: {current_status}")
        
        # Step 1: Extract text if needed
        if current_status in [DocumentStatus.PENDING.value, DocumentStatus.PROCESSING.value, DocumentStatus.TEXT_EXTRACTING.value]:
            document_id = extract_text_task(document_id)
        
        # Step 2: Generate document summary
        if current_status in [DocumentStatus.PENDING.value, DocumentStatus.PROCESSING.value, DocumentStatus.TEXT_EXTRACTING.value, 
                             DocumentStatus.TEXT_EXTRACTION_DONE.value, DocumentStatus.GENERATING_SUMMARY.value]:
            document_id = generate_document_summary_task(document_id)
        
        # Step 3: Chunk and embed text
        if current_status in [DocumentStatus.PENDING.value, DocumentStatus.PROCESSING.value, DocumentStatus.TEXT_EXTRACTING.value,
                             DocumentStatus.TEXT_EXTRACTION_DONE.value, DocumentStatus.SUMMARY_GENERATION_DONE.value, 
                             DocumentStatus.EMBEDDING_TEXT.value]:
            document_id = chunk_and_embed_text_task(document_id)
        
        logger.info(f"Complete document processing finished successfully for document_id: {document_id}")
        return document_id
        
    except Exception as e:
        logger.exception(f"process_document_task failed for {document_id}: {str(e)}")
        try:
            document = Document.objects.get(id=document_id)
            update_document_status(document, document.status, failed=True)
        except Exception as inner_e:
            logger.exception(f"Error updating document status: {str(inner_e)}")
        raise
