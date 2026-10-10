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
    """Platform-wide role. What someone may do inside an organization is its OrgRole."""

    GUEST = "guest"  # a temporary demo account
    USER = "user"
    SUPER_ADMIN = "super_admin"  # creates organizations; sees no organization's data without a membership

    @classmethod
    def choices(cls):
        return [(role.value, role.name) for role in cls]


class OrgRole(Enum):
    ADMIN = "admin"  # manages members, invitations, tags, the AI provider and every document
    MEMBER = "member"  # uploads, edits own documents, searches and chats
    GUEST = "guest"  # searches and chats only (demo visitors)

    @classmethod
    def choices(cls):
        return [(role.value, role.name.title()) for role in cls]


class Provider(Enum):
    """Where an organization's model calls go (with its own key, or the server's Ollama)."""

    OPENROUTER = "openrouter"
    OPENAI = "openai"
    OLLAMA = "ollama"

    @classmethod
    def choices(cls):
        return [(provider.value, provider.name.title()) for provider in cls]


class UsageKind(Enum):
    UPLOAD = "upload"  # amount = pages
    MESSAGE = "message"  # amount = 1 per question
