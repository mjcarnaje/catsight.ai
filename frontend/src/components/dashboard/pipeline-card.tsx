import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, RotateCw } from "lucide-react";
import { Link } from "react-router-dom";

import { DocumentStatusBadge, PipelineProgress } from "@/components/documents/document-status";
import { DocumentThumb } from "@/components/documents/document-thumb";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/use-toast";
import { documentsApi, errorMessage } from "@/lib/api";
import { FAILED_COLOR, STAGES } from "@/lib/document-stages";
import { modelName } from "@/lib/format";
import { keys, useConfig } from "@/lib/queries";
import { cn } from "@/lib/utils";
import type { AppConfig, Dashboard, Document, DocumentStatus } from "@/types";

/** What each stage does, naming the model that does it. */
function stageDetail(stage: DocumentStatus, config?: AppConfig) {
  const local = config?.provider === "ollama";
  switch (stage) {
    case "queued":
      return "Waiting for a worker";
    case "extracting":
      if (config?.extraction.default === "marker") return "Marker (Surya OCR 2) reads each page";
      if (config?.extraction.default === "vision" && config.models) return `${modelName(config.models.ocr)} reads each page`;
      return local ? "Local OCR, page by page" : "OCR, page by page";
    case "summarizing":
      return "Title, summary, reference no., tags";
    case "indexing":
      return config?.models ? `${modelName(config.models.embedding)} + full-text` : "Embeddings + full-text";
    case "ready":
      return "Searchable and citable";
  }
}

/** The ingestion workflow, live: how many documents sit at each stage, and which are moving. */
export function PipelineCard({ data, isLoading }: { data?: Dashboard; isLoading: boolean }) {
  const { data: config } = useConfig();
  const pipeline = data?.pipeline;
  const active = data?.active ?? [];
  const inFlight = pipeline ? STAGES.slice(0, 4).reduce((n, s) => n + pipeline[s.key], 0) : 0;

  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0 pb-4">
        <div className="flex flex-col gap-1.5">
          <CardTitle className="text-sm font-medium">Ingestion pipeline</CardTitle>
          <CardDescription>
            {isLoading
              ? "Loading…"
              : inFlight > 0
                ? `${inFlight} document${inFlight === 1 ? "" : "s"} on the way to searchable`
                : pipeline?.failed
                  ? `${pipeline.failed} need${pipeline.failed === 1 ? "s" : ""} attention`
                  : "Every document is read, catalogued and indexed"}
          </CardDescription>
        </div>
        {!isLoading && inFlight === 0 && !pipeline?.failed && (
          <CheckCircle2 className="size-4 text-muted-foreground" aria-hidden="true" />
        )}
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-5">
        <ol className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-3 md:grid-cols-5">
          {STAGES.map((stage) => {
            const count = pipeline?.[stage.key] ?? 0;
            const busy = stage.key !== "ready" && count > 0;
            return (
              <li key={stage.key} className="flex min-w-0 flex-col gap-1 bg-card p-3 last:col-span-2 sm:last:col-span-1">
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span
                    className={cn("size-1.5 shrink-0 rounded-full", busy && "animate-pulse")}
                    style={{ background: stage.color }}
                  />
                  {stage.label}
                </span>
                <span className={cn("text-xl font-semibold tabular-nums", count === 0 && "text-muted-foreground/60")}>
                  {isLoading ? <Skeleton className="my-1 h-5 w-8" /> : count}
                </span>
                <span className="text-[11px] leading-snug text-muted-foreground">{stageDetail(stage.key, config)}</span>
              </li>
            );
          })}
        </ol>

        {active.length > 0 && (
          <ul className="-mx-2 flex flex-col">
            {active.slice(0, 5).map((doc) => (
              <ActiveRow key={doc.id} doc={doc} />
            ))}
          </ul>
        )}
        {!isLoading && pipeline && pipeline.failed > 0 && (
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="size-1.5 rounded-full" style={{ background: FAILED_COLOR }} />
            Failed documents keep their progress; a retry resumes where they stopped.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function ActiveRow({ doc }: { doc: Document }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const retry = useMutation({
    mutationFn: () => documentsApi.reprocess(doc.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.dashboard });
      queryClient.invalidateQueries({ queryKey: ["documents"] });
    },
    onError: (error) => toast({ title: "Couldn't retry", description: errorMessage(error), variant: "destructive" }),
  });

  return (
    <li className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-muted/50">
      <DocumentThumb previewUrl={doc.preview_url} blurhash={doc.blurhash} className="size-9 shrink-0" />
      <Link to={`/documents/${doc.id}`} className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="flex items-center justify-between gap-3">
          <span className="truncate text-sm font-medium">{doc.title || doc.file_name}</span>
          <DocumentStatusBadge doc={doc} detailed className="hidden shrink-0 sm:inline-flex" />
        </span>
        {doc.is_failed ? (
          <span className="truncate text-xs text-destructive" title={doc.error_message}>
            {doc.error_message || "Processing failed"}
          </span>
        ) : (
          <PipelineProgress doc={doc} />
        )}
      </Link>
      {doc.is_failed && doc.can_edit && (
        <Button variant="ghost" size="sm" onClick={() => retry.mutate()} disabled={retry.isPending}>
          <RotateCw className={cn(retry.isPending && "animate-spin")} />
          Retry
        </Button>
      )}
    </li>
  );
}
