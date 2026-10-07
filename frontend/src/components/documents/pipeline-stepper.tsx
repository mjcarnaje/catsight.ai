import { Check, Loader2, RotateCw, X } from "lucide-react";

import { PipelineProgress } from "@/components/documents/document-status";
import { useReprocess } from "@/components/documents/use-reprocess";
import { Button } from "@/components/ui/button";
import { describeProgress, STAGES, stageIndex } from "@/lib/document-stages";
import { cn } from "@/lib/utils";
import type { Document } from "@/types";

type StepState = "done" | "current" | "failed" | "upcoming";

const STATE_LABEL: Record<StepState, string> = {
  done: "done",
  current: "in progress",
  failed: "failed",
  upcoming: "up next",
};

/**
 * Where a document is in the pipeline: queued, reading, cataloguing, indexing, ready.
 * Shows the live detail ("Reading page 3 of 11") while it runs, and the error with a
 * Retry button when it failed.
 *
 * @example
 * {(isProcessing(doc) || doc.is_failed) && <PipelineStepper doc={doc} />}
 */
export function PipelineStepper({ doc, className }: { doc: Document; className?: string }) {
  const reprocess = useReprocess(doc.id);
  const current = stageIndex(doc.status);

  const stateOf = (index: number): StepState => {
    if (index < current) return "done";
    if (index > current) return "upcoming";
    if (doc.is_failed) return "failed";
    return doc.status === "ready" ? "done" : "current";
  };

  return (
    <section aria-label="Processing progress" className={cn("flex flex-col gap-4 rounded-lg border bg-card p-4 sm:p-5", className)}>
      <ol className="grid grid-cols-5">
        {STAGES.map((stage, index) => {
          const state = stateOf(index);
          return (
            <li
              key={stage.key}
              aria-current={state === "current" || state === "failed" ? "step" : undefined}
              className="relative flex flex-col items-center gap-2 text-center"
            >
              {index > 0 && (
                <span
                  aria-hidden
                  className={cn(
                    "absolute left-[-50%] top-2.5 h-px w-full -translate-y-1/2",
                    index <= current ? "bg-muted-foreground/50" : "bg-border"
                  )}
                />
              )}
              <span
                className={cn(
                  "relative grid size-5 place-items-center rounded-full border bg-card",
                  state === "done" && "border-transparent bg-foreground text-background",
                  state === "current" && "border-foreground text-foreground",
                  state === "failed" && "border-transparent bg-destructive text-destructive-foreground"
                )}
              >
                {state === "done" && <Check className="size-3" strokeWidth={3} />}
                {state === "current" && <Loader2 className="size-3 animate-spin" />}
                {state === "failed" && <X className="size-3" strokeWidth={3} />}
              </span>
              <span
                className={cn(
                  "text-[11px] sm:text-xs",
                  state === "upcoming" ? "text-muted-foreground/60" : state === "failed" ? "text-destructive" : "text-foreground"
                )}
              >
                {stage.label}
                <span className="sr-only"> ({STATE_LABEL[state]})</span>
              </span>
            </li>
          );
        })}
      </ol>

      {doc.is_failed ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between" role="alert">
          <div className="min-w-0 space-y-1">
            <p className="text-sm font-medium text-destructive">{describeProgress(doc)}</p>
            {doc.error_message && (
              <p className="whitespace-pre-wrap break-words text-xs text-muted-foreground">{doc.error_message}</p>
            )}
          </div>
          {doc.can_edit ? (
            <Button
              variant="outline"
              size="sm"
              className="shrink-0 shadow-none"
              disabled={reprocess.isPending}
              onClick={() => reprocess.mutate({})}
            >
              <RotateCw className={reprocess.isPending ? "animate-spin" : undefined} />
              {reprocess.isPending ? "Retrying" : "Retry"}
            </Button>
          ) : (
            <p className="shrink-0 text-xs text-muted-foreground">Only the uploader or an admin can retry.</p>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-sm" role="status">
            {describeProgress(doc)}
          </p>
          <PipelineProgress doc={doc} />
        </div>
      )}
    </section>
  );
}
