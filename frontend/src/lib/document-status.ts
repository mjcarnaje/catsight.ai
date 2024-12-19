// class DocumentStatus(Enum):
//     PENDING = "pending"
//     TEXT_EXTRACTING = "text_extracting"
//     TEXT_EXTRACTED = "text_extracted"
//     GENERATING_SUMMARY = "generating_summary"
//     SUMMARY_GENERATED = "summary_generated"
//     EMBEDDING_TEXT = "embedding_text"
//     EMBEDDED_TEXT = "embedded_text"
//     COMPLETED = "completed"

export enum DocumentStatus {
  PENDING = "pending",
  TEXT_EXTRACTING = "text_extracting",
  TEXT_EXTRACTED = "text_extracted",
  GENERATING_SUMMARY = "generating_summary",
  SUMMARY_GENERATED = "summary_generated",
  EMBEDDING_TEXT = "embedding_text",
  EMBEDDED_TEXT = "embedded_text",
  COMPLETED = "completed",
}

export const DocumentStatusLabel = {
  [DocumentStatus.PENDING]: "Pending",
  [DocumentStatus.TEXT_EXTRACTING]: "Text Extracting",
  [DocumentStatus.TEXT_EXTRACTED]: "Text Extracted",
  [DocumentStatus.GENERATING_SUMMARY]: "Generating Summary",
  [DocumentStatus.SUMMARY_GENERATED]: "Summary Generated",
  [DocumentStatus.EMBEDDING_TEXT]: "Embedding Text",
  [DocumentStatus.EMBEDDED_TEXT]: "Embedded Text",
  [DocumentStatus.COMPLETED]: "Completed",
};

export const DocumentStatusProgress = {
  [DocumentStatus.PENDING]: 0,
  [DocumentStatus.TEXT_EXTRACTING]: 20,
  [DocumentStatus.TEXT_EXTRACTED]: 30,
  [DocumentStatus.GENERATING_SUMMARY]: 50,
  [DocumentStatus.SUMMARY_GENERATED]: 70,
  [DocumentStatus.EMBEDDING_TEXT]: 80,
  [DocumentStatus.EMBEDDED_TEXT]: 90,
  [DocumentStatus.COMPLETED]: 100,
};

export const DocumentStatusColor = {
  [DocumentStatus.PENDING]: {
    text: "text-gray-400",
    bg: "bg-gray-500/20",
    border: "border-gray-500/20",
  },
  [DocumentStatus.TEXT_EXTRACTING]: {
    text: "text-blue-400",
    bg: "bg-blue-500/20",
    border: "border-blue-500/20",
  },
  [DocumentStatus.TEXT_EXTRACTED]: {
    text: "text-blue-400",
    bg: "bg-blue-500/20",
    border: "border-blue-500/20",
  },
  [DocumentStatus.GENERATING_SUMMARY]: {
    text: "text-blue-400",
    bg: "bg-blue-500/20",
    border: "border-blue-500/20",
  },
  [DocumentStatus.SUMMARY_GENERATED]: {
    text: "text-blue-400",
    bg: "bg-blue-500/20",
    border: "border-blue-500/20",
  },
  [DocumentStatus.EMBEDDING_TEXT]: {
    text: "text-blue-400",
    bg: "bg-blue-500/20",
    border: "border-blue-500/20",
  },
  [DocumentStatus.EMBEDDED_TEXT]: {
    text: "text-blue-400",
    bg: "bg-blue-500/20",
    border: "border-blue-500/20",
  },
  [DocumentStatus.COMPLETED]: {
    text: "text-green-400",
    bg: "bg-green-500/20",
    border: "border-green-500/20",
  },
};

export const getDocumentStatus = (
  status: DocumentStatus
): {
  label: string;
  color: { text: string; bg: string; border: string };
  progress: number;
} => {
  const statusLabel = DocumentStatusLabel[status];
  const statusProgress = DocumentStatusProgress[status];
  const statusColor = DocumentStatusColor[status];
  return { label: statusLabel, color: statusColor, progress: statusProgress };
};
