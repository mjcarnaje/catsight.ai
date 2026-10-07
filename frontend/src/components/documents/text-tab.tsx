import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, FileText, Pencil } from "lucide-react";
import { lazy, Suspense, useMemo, useState } from "react";

import { EmptyState } from "@/components/empty-state";
import { Markdown } from "@/components/markdown";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/use-toast";
import { documentsApi, errorMessage } from "@/lib/api";
import { isProcessing, keys } from "@/lib/queries";
import { cn } from "@/lib/utils";
import type { DocumentDetail } from "@/types";

// The editor and its stylesheet are only needed when someone starts editing
const MarkdownEditor = lazy(() => import("@/components/enhanced-markdown-editor"));

/** Same cap the API enforces on saved text. */
const MAX_TEXT_CHARS = 300_000;

/**
 * The extractor marks where each page starts with an HTML comment (`<!-- page:3 -->`), which would
 * show up as literal text. Show a "Page 3" divider instead; the editor keeps the raw markers.
 */
function withPageDividers(markdown: string) {
  return markdown
    .replace(/<!--\s*page:\s*(\d+)\s*-->/gi, "\n\n---\n\n**Page $1**\n\n")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/^\s*---\s*/, "");
}

/**
 * The text extracted from the scan, as rendered Markdown. People who can edit the document can
 * correct it; saving makes the API re-write the summary and re-index the passages.
 *
 * @example
 * <TextTab doc={doc} />
 */
export function TextTab({ doc }: { doc: DocumentDetail }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  const text = useQuery({ queryKey: keys.documentText(doc.id), queryFn: () => documentsApi.text(doc.id) });
  const original = text.data ?? "";
  const processing = isProcessing(doc);
  const rendered = useMemo(() => withPageDividers(original), [original]);

  const save = useMutation({
    mutationFn: (markdown: string) => documentsApi.saveText(doc.id, markdown),
    onSuccess: (_response, markdown) => {
      toast({ title: "Saved. Re-cataloguing and re-indexing…" });
      queryClient.setQueryData(keys.documentText(doc.id), markdown);
      // The document goes back into the pipeline; this also refreshes its passages
      queryClient.invalidateQueries({ queryKey: keys.document(doc.id) });
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      queryClient.invalidateQueries({ queryKey: keys.dashboard });
      queryClient.invalidateQueries({ queryKey: keys.config });
      setEditing(false);
    },
    onError: (error) =>
      toast({ variant: "destructive", title: "Couldn't save the text", description: errorMessage(error) }),
  });

  const startEditing = () => {
    save.reset();
    setDraft(original);
    setEditing(true);
  };

  if (text.isPending) {
    return (
      <div className="flex flex-col gap-3 rounded-lg border bg-card p-6" aria-label="Loading text">
        <Skeleton className="h-4 w-1/3" />
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className={cn("h-3", i % 3 === 2 ? "w-2/3" : "w-full")} />
        ))}
      </div>
    );
  }

  if (text.isError) {
    return (
      <EmptyState
        icon={AlertCircle}
        title="Couldn't load the text"
        description={errorMessage(text.error)}
        action={
          <Button variant="outline" size="sm" onClick={() => text.refetch()}>
            Try again
          </Button>
        }
      />
    );
  }

  if (editing) {
    const dirty = draft !== original;
    const tooLong = draft.length > MAX_TEXT_CHARS;
    const canSave = dirty && draft.trim().length > 0 && !tooLong && !save.isPending;
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">
          Saving re-writes the summary and re-indexes the passages from this text.
        </p>
        {/* The app's editor styles make it fill its parent's height, so the parent needs one */}
        <div className="h-[520px] max-h-[75dvh] overflow-hidden rounded-md border">
          <Suspense fallback={<Skeleton className="size-full rounded-none" />}>
            <MarkdownEditor markdown={draft} onChange={setDraft} height={520} />
          </Suspense>
        </div>
        {save.isError && (
          <p className="flex items-start gap-2 text-sm text-destructive" role="alert">
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
            {errorMessage(save.error)}
          </p>
        )}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className={cn("font-mono text-[10px] uppercase tracking-wider", tooLong ? "text-destructive" : "text-muted-foreground")}>
            {draft.length.toLocaleString()} / {MAX_TEXT_CHARS.toLocaleString()} characters
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => {
                save.reset();
                setEditing(false);
              }}
              disabled={save.isPending}
            >
              {dirty ? "Discard changes" : "Cancel"}
            </Button>
            <Button onClick={() => save.mutate(draft)} disabled={!canSave}>
              {save.isPending ? "Saving" : "Save"}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!original.trim()) {
    return (
      <EmptyState
        icon={FileText}
        title="No text yet"
        description={
          processing
            ? "The text appears once the pages have been read."
            : "No text was extracted from this document."
        }
        action={
          doc.can_edit &&
          !processing && (
            <Button variant="outline" size="sm" onClick={startEditing}>
              <Pencil />
              Add text
            </Button>
          )
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          Extracted text · {original.length.toLocaleString()} characters
        </span>
        {doc.can_edit && (
          <Button
            variant="outline"
            size="sm"
            className="shadow-none"
            disabled={processing}
            title={processing ? "Wait for processing to finish" : undefined}
            onClick={startEditing}
          >
            <Pencil />
            Edit
          </Button>
        )}
      </div>
      <div className="rounded-lg border bg-card p-4 sm:p-6">
        <Markdown content={rendered} className="prose-sm break-words" />
      </div>
    </div>
  );
}
