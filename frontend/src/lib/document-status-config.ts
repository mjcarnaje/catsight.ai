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

export type StatusConfigType = {
  label: string;
  text: string;
  bg: string;
  border: string;
  showLoading: boolean;
};

export const documentStatusConfig: Record<DocumentStatus, StatusConfigType> = {
  [DocumentStatus.PENDING]: {
    label: "Pending",
    text: "text-gray-600",
    bg: "bg-gray-100",
    border: "border-gray-400",
    showLoading: false,
  },
  [DocumentStatus.TEXT_EXTRACTING]: {
    label: "Text Extracting",
    text: "text-blue-600",
    bg: "bg-blue-100",
    border: "border-blue-400",
    showLoading: true,
  },
  [DocumentStatus.TEXT_EXTRACTED]: {
    label: "Text Extracted",
    text: "text-blue-600",
    bg: "bg-blue-100",
    border: "border-blue-400",
    showLoading: true,
  },
  [DocumentStatus.GENERATING_SUMMARY]: {
    label: "Generating Summary",
    text: "text-blue-600",
    bg: "bg-blue-100",
    border: "border-blue-400",
    showLoading: true,
  },
  [DocumentStatus.SUMMARY_GENERATED]: {
    label: "Summary Generated",
    text: "text-blue-600",
    bg: "bg-blue-100",
    border: "border-blue-400",
    showLoading: true,
  },
  [DocumentStatus.EMBEDDED_TEXT]: {
    label: "Embedded Text",
    text: "text-blue-600",
    bg: "bg-blue-100",
    border: "border-blue-400",
    showLoading: true,
  },
  [DocumentStatus.EMBEDDING_TEXT]: {
    label: "Embedding Text",
    text: "text-blue-600",
    bg: "bg-blue-100",
    border: "border-blue-400",
    showLoading: true,
  },
  [DocumentStatus.COMPLETED]: {
    label: "Completed",
    text: "text-green-600",
    bg: "bg-green-100",
    border: "border-green-400",
    showLoading: false,
  },
};

export interface StatusDisplayInfo {
  label: string;
  color: StatusConfigType;
  showLoading: boolean;
}

// Returns the status display information for a given status
export const getDocumentStatusDisplay = (
  status: DocumentStatus
): StatusDisplayInfo => {
  const statusLabel = documentStatusConfig[status]?.label || "Unknown";
  const statusColor =
    documentStatusConfig[status] ||
    documentStatusConfig[DocumentStatus.PENDING];
  return {
    label: statusLabel,
    color: statusColor,
    showLoading: statusColor.showLoading,
  };
};

export interface DocumentStatusWithProgress extends StatusDisplayInfo {
  progress: number;
  currentStatus: DocumentStatus;
}

export interface StatusHistoryEntry {
  status: DocumentStatus;
  changed_at: string | null;
}

// Calculate document status and progress based on status history
export const calculateDocumentStatusFromHistory = (
  statusHistory?: StatusHistoryEntry[]
): DocumentStatusWithProgress => {
  if (!statusHistory || statusHistory.length === 0) {
    const defaultStatus = DocumentStatus.PENDING;
    return {
      ...getDocumentStatusDisplay(defaultStatus),
      progress: 0,
      currentStatus: defaultStatus,
    };
  }

  // Create a map to store the most recent entry for each status
  const statusMap: Record<string, StatusHistoryEntry> = {};

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
    ...getDocumentStatusDisplay(currentStatus),
    progress: progress,
    currentStatus: currentStatus,
  };
};
