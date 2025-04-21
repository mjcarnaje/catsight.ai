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
    try:
        document = Document.objects.get(id=document_id)
        
        if not document.file or not os.path.exists(document.file):
            logger.error(f"File not found: {document.file}")
            update_document_status(document, DocumentStatus.PENDING, failed=True)
            return document_id

        update_document_status(document, DocumentStatus.TEXT_EXTRACTING)

        if document.markdown_converter == MarkdownConverter.MARKER.value:
            text = convert_pdf_with_marker(document.file)
        elif document.markdown_converter == MarkdownConverter.MARKITDOWN.value:
            text = convert_pdf_with_markitdown(document.file)
        elif document.markdown_converter == MarkdownConverter.DOCLING.value:
            text = convert_pdf_with_docling(document.file)
        else:
            raise ValueError(f"Invalid converter: {document.markdown_converter}")

        DocumentFullText.objects.update_or_create(
            document=document,
            defaults={"text": text}
        )
        update_document_status(document, DocumentStatus.TEXT_EXTRACTED)
        return document_id

    except Exception as e:
        logger.exception(f"extract_text_task failed for {document_id}")
        if 'document' in locals():
            update_document_status(document, DocumentStatus.TEXT_EXTRACTING, failed=True)
        raise


@shared_task(bind=True)
def chunk_and_embed_text_task(self, document_id):
    """
    Splits markdown text into chunks and embeds them in the vector store.
    """
    try:
        document = Document.objects.get(id=document_id)
        update_document_status(document, DocumentStatus.EMBEDDING_TEXT)

        fulltext = DocumentFullText.objects.get(document=document).text

        splitter = RecursiveCharacterTextSplitter(
            chunk_size=1000,
            chunk_overlap=200,
            separators=["\n\n", "\n", " ", ""]
        )
        docs = splitter.split_documents([LangchainDocument(page_content=fulltext)])

        count = save_document_chunks(document, docs)
        document.no_of_chunks = count
        document.save(update_fields=["no_of_chunks"])

        update_document_status(
            document,
            DocumentStatus.EMBEDDED_TEXT,
            update_fields=["status", "no_of_chunks"]
        )
        return document_id

    except Exception as e:
        logger.exception(f"chunk_and_embed_text_task failed for {document_id}")
        if 'document' in locals():
            update_document_status(document, DocumentStatus.EMBEDDING_TEXT, failed=True)
        raise


@shared_task(bind=True)
def generate_document_summary_task(self, document_id):
    """
    Generates a title and summary from the first chunk.
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
            first = chunks[0]
            title, summary = DocumentProcessor.generate_information(first.page_content)
            document.title = title
            document.description = summary
            document.save(update_fields=["title", "description"])
            update_document_status(document, DocumentStatus.SUMMARY_GENERATED,
                                   update_fields=["status", "title", "description"])

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
