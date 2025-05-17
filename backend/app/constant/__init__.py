from enum import Enum


class DocumentStatus(Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    TEXT_EXTRACTING = "text_extracting" 
    TEXT_EXTRACTION_DONE = "text_extraction_done"
    EMBEDDING_TEXT = "embedding_text"
    TEXT_EMBEDDING_DONE = "text_embedding_done"
    GENERATING_SUMMARY = "generating_summary"
    SUMMARY_GENERATION_DONE = "summary_generation_done"
    COMPLETED = "completed"

STATUS_ORDER = {
    DocumentStatus.PENDING: 0,
    DocumentStatus.PROCESSING: 1,
    DocumentStatus.TEXT_EXTRACTING: 2,
    DocumentStatus.TEXT_EXTRACTION_DONE: 3,
    DocumentStatus.EMBEDDING_TEXT: 4,
    DocumentStatus.TEXT_EMBEDDING_DONE: 5,
    DocumentStatus.GENERATING_SUMMARY: 6,
    DocumentStatus.SUMMARY_GENERATION_DONE: 7,
    DocumentStatus.COMPLETED: 8,
}

class MarkdownConverter(Enum):
    MARKER = "marker"
    MARKITDOWN = "markitdown"
    DOCLING = "docling"

class UserRole(Enum):
    USER = "user"
    ADMIN = "admin"
    SUPER_ADMIN = "super_admin"

    @classmethod
    def choices(cls):
        return [(role.value, role.name) for role in cls]
