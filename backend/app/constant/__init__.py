from enum import Enum

class DocumentStatus(Enum):
    PENDING = "pending"
    TEXT_EXTRACTING = "text_extracting" 
    TEXT_EXTRACTED = "text_extracted"
    GENERATING_SUMMARY = "generating_summary"
    SUMMARY_GENERATED = "summary_generated"
    EMBEDDING_TEXT = "embedding_text"
    EMBEDDED_TEXT = "embedded_text"
    COMPLETED = "completed"
