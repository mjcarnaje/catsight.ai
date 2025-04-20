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
  EMBEDDING_TEXT = "embedding_text",
  EMBEDDED_TEXT = "embedded_text",
  SUMMARY_GENERATED = "summary_generated",
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
  [DocumentStatus.EMBEDDED_TEXT]: {
    text: "text-blue-400",
    bg: "bg-blue-500/20",
    border: "border-blue-500/20",
  },
  [DocumentStatus.EMBEDDING_TEXT]: {
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

// Returns the status info for a given status
export const getStatusInfo = (
  status: DocumentStatus
): {
  label: string;
  color: { text: string; bg: string; border: string };
} => {
  const statusLabel = DocumentStatusLabel[status] || "Unknown";
  const statusColor =
    DocumentStatusColor[status] || DocumentStatusColor[DocumentStatus.PENDING];
  return { label: statusLabel, color: statusColor };
};

// Calculate document status and progress based on status history
export const getDocumentStatusFromHistory = (
  statusHistory?: { status: DocumentStatus; changed_at: string | null }[]
): {
  label: string;
  color: { text: string; bg: string; border: string };
  progress: number;
  currentStatus: DocumentStatus;
} => {
  if (!statusHistory || statusHistory.length === 0) {
    const defaultStatus = DocumentStatus.PENDING;
    return {
      ...getStatusInfo(defaultStatus),
      progress: 0,
      currentStatus: defaultStatus,
    };
  }

  // Create a map to store the most recent entry for each status
  const statusMap: Record<
    string,
    { status: DocumentStatus; changed_at: string | null }
  > = {};

  // Get the most recent record for each status (handling potential duplicates)
  statusHistory.forEach((record) => {
    const existingRecord = statusMap[record.status];

    // If we don't have this status yet or this record is more recent
    if (
      !existingRecord ||
      (record.changed_at &&
        (!existingRecord.changed_at ||
          new Date(record.changed_at) > new Date(existingRecord.changed_at)))
    ) {
      statusMap[record.status] = record;
    }
  });

  // Find completedStatuses (those with non-null timestamps)
  const completedStatuses = statusHistory.filter((s) => s.changed_at !== null);

  // Find the highest completed status in the workflow
  const currentStatus =
    completedStatuses.length > 0
      ? completedStatuses[0].status
      : DocumentStatus.PENDING;

  // Calculate progress based on percentage of statuses with timestamps
  const totalSteps = statusHistory.length;
  const completedSteps = completedStatuses.length;
  const progress = Math.min(
    Math.round((completedSteps / totalSteps) * 100),
    100
  );

  return {
    ...getStatusInfo(currentStatus),
    progress: progress,
    currentStatus: currentStatus,
  };
};
