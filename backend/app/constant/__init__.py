from enum import Enum


class DocumentStatus(Enum):
    """Pipeline stage a document is in. A failure keeps the stage it failed at
    (with Document.is_failed set), so a retry resumes from that stage."""

    QUEUED = "queued"
    EXTRACTING = "extracting"
    SUMMARIZING = "summarizing"
    INDEXING = "indexing"
    READY = "ready"

    @classmethod
    def choices(cls):
        return [(status.value, status.name.title()) for status in cls]


STATUS_ORDER = {status: i for i, status in enumerate(DocumentStatus)}


class TextExtractor(Enum):
    VISION = "vision"  # page images -> OCR_MODEL (OpenRouter)
    MARKER = "marker"  # local, needs the local-ocr image
    DOCLING = "docling"  # local, needs the local-ocr image
    MARKITDOWN = "markitdown"  # local, text layer only (no OCR)


class UserRole(Enum):
    GUEST = "guest"
    USER = "user"
    ADMIN = "admin"
    SUPER_ADMIN = "super_admin"

    @classmethod
    def choices(cls):
        return [(role.value, role.name) for role in cls]


class UsageKind(Enum):
    UPLOAD = "upload"  # amount = pages
    MESSAGE = "message"  # amount = 1 per question
