import { AlertCircle } from "lucide-react";

import { describeProgress, FAILED_COLOR, overallProgress, stageOf } from "@/lib/document-stages";
import { cn } from "@/lib/utils";
import type { Document } from "@/types";

type StatusFields = Pick<Document, "status" | "is_failed" | "progress_done" | "progress_total">;

/** Dot + stage label ("Reading page 3 of 11", "Ready", "Failed while …"). */
export function DocumentStatusBadge({ doc, detailed = false, className }: { doc: StatusFields; detailed?: boolean; className?: string }) {
  const stage = stageOf(doc.status);
  const ready = doc.status === "ready" && !doc.is_failed;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap text-xs",
        doc.is_failed ? "text-destructive" : ready ? "text-muted-foreground" : "text-foreground",
        className
      )}
    >
      {doc.is_failed ? (
        <AlertCircle className="size-3.5" />
      ) : (
        <span
          className={cn("size-1.5 shrink-0 rounded-full", !ready && "animate-pulse")}
          style={{ background: stage.color }}
        />
      )}
      {doc.is_failed ? (detailed ? describeProgress(doc) : "Failed") : detailed ? describeProgress(doc) : stage.label}
    </span>
  );
}

/** Thin bar showing how far a document is through the whole pipeline. */
export function PipelineProgress({ doc, className }: { doc: StatusFields; className?: string }) {
  const value = Math.round(overallProgress(doc) * 100);
  return (
    <div
      className={cn("h-1 w-full overflow-hidden rounded-full bg-muted", className)}
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="h-full rounded-full transition-[width] duration-700 ease-out"
        style={{ width: `${Math.max(value, 4)}%`, background: doc.is_failed ? FAILED_COLOR : stageOf(doc.status).color }}
      />
    </div>
  );
}
