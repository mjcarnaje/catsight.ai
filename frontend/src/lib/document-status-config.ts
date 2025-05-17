export enum DocumentStatus {
  PENDING = "pending",
  PROCESSING = "processing",
  TEXT_EXTRACTING = "text_extracting",
  TEXT_EXTRACTION_DONE = "text_extraction_done",
  EMBEDDING_TEXT = "embedding_text",
  TEXT_EMBEDDING_DONE = "text_embedding_done",
  GENERATING_SUMMARY = "generating_summary",
  SUMMARY_GENERATION_DONE = "summary_generation_done",
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
      text: "text-gray-500",
      bg: "bg-gray-50",
      border: "border-gray-300",
      showLoading: false,
    },
    [DocumentStatus.PROCESSING]: {
      label: "Process Started",
      text: "text-gray-500",
      bg: "bg-gray-50",
      border: "border-gray-300",
      showLoading: true,
    },
    [DocumentStatus.TEXT_EXTRACTING]: {
      label: "Text Extracting",
      text: "text-blue-500",
      bg: "bg-blue-50",
      border: "border-blue-300",
      showLoading: true,
    },
    [DocumentStatus.TEXT_EXTRACTION_DONE]: {
      label: "Text Extracted",
      text: "text-blue-600",
      bg: "bg-blue-50",
      border: "border-blue-300",
      showLoading: true,
    },
    [DocumentStatus.EMBEDDING_TEXT]: {
      label: "Text Embedding",
      text: "text-indigo-500",
      bg: "bg-indigo-50",
      border: "border-indigo-300",
      showLoading: true,
    },
    [DocumentStatus.TEXT_EMBEDDING_DONE]: {
      label: "Text Embedding Done",
      text: "text-indigo-600",
      bg: "bg-indigo-50",
      border: "border-indigo-300",
      showLoading: true,
    },
    [DocumentStatus.GENERATING_SUMMARY]: {
      label: "Generating Summary",
      text: "text-purple-500",
      bg: "bg-purple-50",
      border: "border-purple-300",
      showLoading: true,
    },
    [DocumentStatus.SUMMARY_GENERATION_DONE]: {
      label: "Summary Generated",
      text: "text-purple-600",
      bg: "bg-purple-50",
      border: "border-purple-300",
      showLoading: true,
    },
    [DocumentStatus.COMPLETED]: {
      label: "Completed",
      text: "text-green-600",
      bg: "bg-green-50",
      border: "border-green-300",
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
