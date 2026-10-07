import { Lock, RotateCw } from "lucide-react";
import { Link } from "react-router-dom";

import { DocumentStatusBadge, PipelineProgress } from "@/components/documents/document-status";
import { DocumentThumb } from "@/components/documents/document-thumb";
import { useReprocess } from "@/components/documents/use-reprocess";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { timeAgo, plural } from "@/lib/format";
import { isProcessing } from "@/lib/queries";
import type { Document } from "@/types";

const MAX_TAGS = 3;

/**
 * One line of the library list. The whole row is a link to the document (the title's
 * `::after` stretches over it); buttons inside sit above it with `relative z-10`.
 *
 * @example
 * <ul className="divide-y"><DocumentRow doc={doc} /></ul>
 */
export function DocumentRow({ doc }: { doc: Document }) {
  const reprocess = useReprocess(doc.id);
  const processing = isProcessing(doc);
  const title = doc.title || doc.file_name;
  const subtitle = [doc.reference_number, doc.year].filter(Boolean).join(" · ") || (doc.title ? doc.file_name : "");
  const hiddenTags = doc.tags.length - MAX_TAGS;

  const meta = [doc.page_count > 0 ? plural(doc.page_count, "page") : null, timeAgo(doc.created_at)].filter(Boolean);

  return (
    <li className="relative flex gap-3 px-3 py-3 transition-colors focus-within:bg-accent/40 hover:bg-accent/40 sm:gap-4 sm:px-4">
      <DocumentThumb previewUrl={doc.preview_url} blurhash={doc.blurhash} className="h-14 w-10 shrink-0" />

      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="min-w-0">
          <Link
            to={`/documents/${doc.id}`}
            className="block truncate text-sm font-medium after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:ring-1 focus-visible:after:ring-inset focus-visible:after:ring-ring"
          >
            {title}
          </Link>
          {(subtitle || doc.is_private) && (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              {subtitle && <span className="truncate">{subtitle}</span>}
              {doc.is_private && (
                <span className="inline-flex shrink-0 items-center gap-1" title="Only you can see this document">
                  <Lock className="size-3" aria-hidden />
                  Only you
                </span>
              )}
            </p>
          )}
        </div>

        {doc.tags.length > 0 && (
          <ul className="flex flex-wrap gap-1" aria-label="Tags">
            {doc.tags.slice(0, MAX_TAGS).map((tag) => (
              <li key={tag.id} className="max-w-40 truncate rounded border px-1.5 py-px text-[11px] text-muted-foreground">
                {tag.name}
              </li>
            ))}
            {hiddenTags > 0 && <li className="px-1 py-px text-[11px] text-muted-foreground">+{hiddenTags}</li>}
          </ul>
        )}

        {processing && <PipelineProgress doc={doc} className="mt-0.5 max-w-sm" />}

        {doc.is_failed && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            {doc.error_message && <p className="line-clamp-2 min-w-0 text-xs text-destructive">{doc.error_message}</p>}
            {doc.can_edit && (
              <Button
                variant="outline"
                size="sm"
                className="relative z-10 h-7 gap-1.5 px-2.5 shadow-none"
                disabled={reprocess.isPending}
                onClick={() => reprocess.mutate({})}
              >
                <RotateCw className={reprocess.isPending ? "animate-spin" : undefined} />
                {reprocess.isPending ? "Retrying" : "Retry"}
              </Button>
            )}
          </div>
        )}

        {/* Phones: status and meta sit under the title */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground sm:hidden">
          <DocumentStatusBadge doc={doc} detailed={processing} />
          <span>{meta.join(" · ")}</span>
        </div>
      </div>

      {/* From sm up: a fixed column on the right */}
      <div className="hidden w-48 shrink-0 flex-col items-end gap-1 text-right sm:flex">
        <DocumentStatusBadge doc={doc} detailed={processing} />
        <span className="text-xs text-muted-foreground">{meta.join(" · ")}</span>
      </div>
    </li>
  );
}

export function DocumentRowSkeleton() {
  return (
    <li className="flex gap-3 px-3 py-3 sm:gap-4 sm:px-4" aria-hidden>
      <Skeleton className="h-14 w-10 shrink-0 rounded-md" />
      <div className="flex min-w-0 flex-1 flex-col gap-2 pt-0.5">
        <Skeleton className="h-4 w-3/5" />
        <Skeleton className="h-3 w-2/5" />
        <Skeleton className="h-3 w-24" />
      </div>
      <div className="hidden w-48 shrink-0 flex-col items-end gap-2 pt-0.5 sm:flex">
        <Skeleton className="h-3.5 w-16" />
        <Skeleton className="h-3 w-28" />
      </div>
    </li>
  );
}
