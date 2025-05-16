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

export const DOCUMENT_STATUS_CONFIG: Record<DocumentStatus, StatusConfigType> =
  {
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

export interface DocumentStatusWithProgress extends StatusDisplayInfo {
  progress: number;
  currentStatus: DocumentStatus;
}

export interface StatusHistoryEntry {
  status: DocumentStatus;
  changed_at: string | null;
}

export const getDocumentProgress = (
  statusHistory?: StatusHistoryEntry[]
): number => {
  if (!statusHistory || statusHistory.length === 0) {
    return 0;
  }

  const statusMap: Record<string, StatusHistoryEntry> = {};

  statusHistory.forEach((record) => {
    const existingRecord = statusMap[record.status];

    if (
      !existingRecord ||
      (record.changed_at &&
        (!existingRecord.changed_at ||
          new Date(record.changed_at).getTime() >
            new Date(existingRecord.changed_at).getTime()))
    ) {
      statusMap[record.status] = record;
    }
  });

  const completedStatuses = Object.values(statusMap).filter(
    (s) => s.changed_at !== null
  );

  const totalSteps = Object.keys(statusMap).length;
  const completedSteps = completedStatuses.length;
  const progress = Math.min(
    Math.round((completedSteps / totalSteps) * 100),
    100
  );

  return progress;
};
