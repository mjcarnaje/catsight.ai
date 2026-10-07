import { DocumentStatus } from "@/lib/document-status-config";

/**
 * The backend reports nine fine-grained processing statuses. For people,
 * five stages are enough: queued → extracting → summarizing → embedding → ready.
 */
export const DOCUMENT_STAGES = [
  { key: "queued", label: "Queued", color: "hsl(var(--muted-foreground) / 0.35)" },
  { key: "extracting", label: "Extracting text", color: "hsl(var(--chart-3))" },
  { key: "summarizing", label: "Summarizing", color: "hsl(var(--chart-2))" },
  { key: "embedding", label: "Indexing", color: "hsl(var(--chart-4))" },
  { key: "ready", label: "Ready", color: "hsl(var(--chart-1))" },
] as const;

export type DocumentStageKey = (typeof DOCUMENT_STAGES)[number]["key"];

const STATUS_TO_STAGE: Record<DocumentStatus, DocumentStageKey> = {
  [DocumentStatus.PENDING]: "queued",
  [DocumentStatus.PROCESSING]: "queued",
  [DocumentStatus.TEXT_EXTRACTING]: "extracting",
  [DocumentStatus.TEXT_EXTRACTION_DONE]: "extracting",
  [DocumentStatus.GENERATING_SUMMARY]: "summarizing",
  [DocumentStatus.SUMMARY_GENERATION_DONE]: "summarizing",
  [DocumentStatus.EMBEDDING_TEXT]: "embedding",
  [DocumentStatus.TEXT_EMBEDDING_DONE]: "embedding",
  [DocumentStatus.COMPLETED]: "ready",
};

export function getDocumentStage(status: string) {
  const key = STATUS_TO_STAGE[status as DocumentStatus] ?? "queued";
  return DOCUMENT_STAGES.find((s) => s.key === key)!;
}

/** Sums `documents_by_status` into the five stages, in pipeline order. */
export function countByStage(byStatus: Record<string, number> = {}) {
  const totals = new Map<DocumentStageKey, number>(DOCUMENT_STAGES.map((s) => [s.key, 0]));
  for (const [status, count] of Object.entries(byStatus)) {
    const key = getDocumentStage(status).key;
    totals.set(key, (totals.get(key) ?? 0) + count);
  }
  return DOCUMENT_STAGES.map((stage) => ({ ...stage, count: totals.get(stage.key) ?? 0 }));
}
