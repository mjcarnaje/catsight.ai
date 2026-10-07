import type { Document, DocumentStatus } from "@/types";

/** The pipeline, in order, as people see it. */
export const STAGES: { key: DocumentStatus; label: string; doing: string; color: string }[] = [
  { key: "queued", label: "Queued", doing: "Waiting to start", color: "hsl(var(--muted-foreground) / 0.45)" },
  { key: "extracting", label: "Reading", doing: "Reading pages", color: "hsl(var(--chart-3))" },
  { key: "summarizing", label: "Cataloguing", doing: "Writing the summary", color: "hsl(var(--chart-2))" },
  { key: "indexing", label: "Indexing", doing: "Indexing passages", color: "hsl(var(--chart-4))" },
  { key: "ready", label: "Ready", doing: "Searchable", color: "hsl(var(--success))" },
];

export const FAILED_COLOR = "hsl(var(--destructive))";

export function stageOf(status: DocumentStatus) {
  return STAGES.find((s) => s.key === status) ?? STAGES[0];
}

export function stageIndex(status: DocumentStatus) {
  return Math.max(0, STAGES.findIndex((s) => s.key === status));
}

/** One line describing where a document is, e.g. "Reading page 3 of 11". */
export function describeProgress(doc: Pick<Document, "status" | "is_failed" | "progress_done" | "progress_total">) {
  const stage = stageOf(doc.status);
  if (doc.is_failed) return `Failed while ${stage.doing.toLowerCase()}`;
  if (doc.status === "extracting" && doc.progress_total)
    return `Reading page ${Math.min(doc.progress_done + 1, doc.progress_total)} of ${doc.progress_total}`;
  if (doc.status === "indexing" && doc.progress_total)
    return `Indexing ${doc.progress_done} of ${doc.progress_total} passages`;
  return stage.doing;
}

/** 0-1 progress through the whole pipeline (for a thin progress bar). */
export function overallProgress(doc: Pick<Document, "status" | "progress_done" | "progress_total">) {
  const index = stageIndex(doc.status);
  if (doc.status === "ready") return 1;
  const within = doc.progress_total ? doc.progress_done / doc.progress_total : 0.15;
  return (index - 1 + within) / (STAGES.length - 2);
}
