import asyncio
import logging
import os
from functools import lru_cache

from celery import shared_task
from django.conf import settings
from django.utils import timezone
from langchain_core.documents import Document as Doc

from ..constant import STATUS_ORDER, DocumentStatus, MarkdownConverter
from ..models import Document, DocumentFullText, DocumentStatusHistory
from ..services.summarization_agent import summarization_agent, summarization_splitter
from ..services.vectorstore import delete_document_chunks, vector_store
from ..utils.chunking import split_markdown

logger = logging.getLogger(__name__)

# Parallel chunk summaries sent to Ollama at once. Higher doesn't help on CPU and
# a long document would otherwise fire hundreds of requests simultaneously.
SUMMARY_MAX_CONCURRENCY = 2


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
    """Replace a document's chunks in the vector store.

    Old chunks are deleted first and every chunk gets a stable id, so
    re-processing never leaves duplicates or stale chunks behind.
    """
    removed = delete_document_chunks(document.id)
    if removed:
        logger.info(f"Removed {removed} old chunks for document {document.id}")
    vector_store.add_documents(docs, ids=[doc.metadata["id"] for doc in docs])
    logger.info(f"Added {len(docs)} chunks for document {document.id}")
    return len(docs)


# --- PDF -> Markdown converters ----------------------------------------------
@lru_cache(maxsize=1)
def get_marker_converter():
    from marker.config.parser import ConfigParser
    from marker.converters.pdf import PdfConverter
    from marker.models import create_model_dict

    marker_config = {
        "output_format": "markdown",
        "disable_multiprocessing": False,
        "disable_image_extraction": True,
        "ollama_base_url": settings.OLLAMA_BASE_URL,
        "llm_service": "marker.services.ollama.OllamaService",
        "ollama_model": settings.CHAT_MODEL,
        "force_ocr": True,
        "strip_existing_ocr": True,
        "use_llm": False,
        "debug": False,
        "paginate_output": True,  # page markers become chunk page numbers (utils/chunking.py)
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


CONVERTERS = {
    MarkdownConverter.MARKER.value: convert_pdf_with_marker,
    MarkdownConverter.MARKITDOWN.value: convert_pdf_with_markitdown,
    MarkdownConverter.DOCLING.value: convert_pdf_with_docling,
}


# --- Pipeline steps -----------------------------------------------------------
@shared_task(bind=True)
def extract_text_task(self, document_id):
    """
    Extracts markdown text from the uploaded file and saves it.

    A converter failure (or a result with no text, e.g. markitdown on a scanned
    PDF) fails the document instead of storing placeholder text, so nothing
    downstream summarizes or embeds an error message.
    """
    logger.info(f"Starting extract_text_task for document_id: {document_id}")
    try:
        document = Document.objects.get(id=document_id)
        full_file_path = os.path.join(settings.MEDIA_ROOT, document.file)

        if not document.file or not os.path.exists(full_file_path):
            raise FileNotFoundError(f"File not found: {document.file} (full path: {full_file_path})")

        update_document_status(document, DocumentStatus.TEXT_EXTRACTING)

        converter_name = document.markdown_converter or MarkdownConverter.MARKER.value
        converter = CONVERTERS.get(converter_name)
        if converter is None:
            raise ValueError(f"Invalid converter: {converter_name}")

        text = converter(full_file_path)
        if not text or not text.strip():
            raise ValueError(
                f"{converter_name} extracted no text from {document.file}; "
                "for scanned PDFs use marker or docling (they run OCR)"
            )
        logger.info(f"Extracted {len(text)} characters with {converter_name}")

        DocumentFullText.objects.update_or_create(document=document, defaults={"text": text})
        update_document_status(document, DocumentStatus.TEXT_EXTRACTION_DONE)
        return document_id

    except Exception as e:
        logger.exception(f"extract_text_task failed for {document_id}: {str(e)}")
        if 'document' in locals():
            update_document_status(document, DocumentStatus.TEXT_EXTRACTING, failed=True)
        raise


@shared_task(bind=True)
def chunk_and_embed_text_task(self, document_id):
    """
    Splits markdown into section-aware chunks and embeds them in the vector store.
    """
    logger.info(f"Starting chunk_and_embed_text_task for document_id: {document_id}")
    try:
        document = Document.objects.get(id=document_id)
        update_document_status(document, DocumentStatus.EMBEDDING_TEXT)

        fulltext = DocumentFullText.objects.get(document=document).text
        chunks = split_markdown(fulltext)
        if not chunks:
            raise ValueError(f"Document {document_id} has no text to embed")
        logger.info(f"Split text into {len(chunks)} chunks")

        # Year and tags are deliberately not copied into chunks: they change when a
        # summary is regenerated, so search filters read them from the Document instead.
        docs = [
            Doc(
                page_content=chunk.text,
                metadata={
                    "doc_id": document.id,
                    "id": f"doc_{document.id}_chunk_{i}",
                    "index": i,
                    "page": chunk.page,
                    "section": chunk.section,
                },
            )
            for i, chunk in enumerate(chunks)
        ]

        document.no_of_chunks = save_document_chunks(document, docs)
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
    Generates the summary, title, year and tags with the map-reduce summarizer.
    """
    try:
        document = Document.objects.get(id=document_id)
        fulltext = DocumentFullText.objects.get(document=document).text
        update_document_status(document, DocumentStatus.GENERATING_SUMMARY)

        chunks = summarization_splitter.split_text(fulltext)
        model_name = document.summarization_model or settings.CHAT_MODEL
        logger.info(f"Summarizing document {document_id} ({len(chunks)} chunks) with {model_name}")

        final_state = asyncio.run(summarization_agent.ainvoke(
            {"contents": chunks, "model_name": model_name},
            config={"max_concurrency": SUMMARY_MAX_CONCURRENCY},
        ))

        logger.info(f"[TITLE] {final_state['title']}")
        logger.info(f"[SUMMARY] {final_state['final_summary']}")
        logger.info(f"[YEAR] {final_state['year']}")
        logger.info(f"[TAGS] {final_state['tags']}")

        document.title = final_state["title"]
        document.summary = final_state["final_summary"]
        document.year = final_state["year"]
        document.tags.set(final_state["tags"])

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
    Process a document completely: extract text, generate the summary, then chunk and embed.

    Resumes from the document's saved status, so a retry after a failure only
    re-runs the steps that haven't finished.
    """
    logger.info(f"Starting complete document processing for document_id: {document_id}")

    try:
        document = Document.objects.get(id=document_id)
        # Read progress BEFORE marking the document as processing
        try:
            progress = STATUS_ORDER[DocumentStatus(document.status)]
        except ValueError:
            progress = 0
        if progress >= STATUS_ORDER[DocumentStatus.COMPLETED]:
            # Nothing left to run; don't leave it parked at PROCESSING
            logger.info(f"Document {document_id} is already completed; nothing to do")
            return document_id
        logger.info(f"Document {document_id} resuming from status: {document.status}")

        document.is_failed = False
        update_document_status(document, DocumentStatus.PROCESSING, update_fields=["is_failed"])

        if progress < STATUS_ORDER[DocumentStatus.TEXT_EXTRACTION_DONE]:
            extract_text_task(document_id)

        if progress < STATUS_ORDER[DocumentStatus.SUMMARY_GENERATION_DONE]:
            generate_document_summary_task(document_id)

        if progress < STATUS_ORDER[DocumentStatus.COMPLETED]:
            chunk_and_embed_text_task(document_id)

        logger.info(f"Complete document processing finished successfully for document_id: {document_id}")
        return document_id

    except Exception as e:
        # The failing step already marked the document failed at its own status
        logger.exception(f"process_document_task failed for {document_id}: {str(e)}")
        raise
