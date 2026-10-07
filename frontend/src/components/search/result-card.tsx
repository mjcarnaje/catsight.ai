import { Link } from "react-router-dom";

import { DocumentThumb } from "@/components/documents/document-thumb";
import { Highlight } from "@/components/search/highlight";
import { Passage } from "@/components/search/passage";
import { Skeleton } from "@/components/ui/skeleton";
import { plural } from "@/lib/format";
import type { SearchResult } from "@/types";

/** A document and the passages of it that matched, in the order the API ranked them. */
export function ResultCard({ result, pattern }: { result: SearchResult; pattern: RegExp | null }) {
  const { document: doc, passages } = result;
  return (
    <article className="overflow-hidden rounded-lg border bg-card">
      <header className="flex gap-3 p-4">
        <DocumentThumb previewUrl={doc.preview_url} blurhash={doc.blurhash} className="h-14 w-11 shrink-0" />
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <h3 className="text-sm font-medium leading-snug">
            <Link
              to={`/documents/${doc.id}`}
              className="break-words rounded-sm outline-none hover:underline focus-visible:ring-1 focus-visible:ring-ring"
            >
              <Highlight text={doc.title} pattern={pattern} />
            </Link>
          </h3>
          <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
            {doc.reference_number && (
              <span className="break-all font-mono">
                <Highlight text={doc.reference_number} pattern={pattern} />
              </span>
            )}
            {doc.year && <span>{doc.year}</span>}
            <span>{plural(passages.length, "passage")}</span>
          </p>
          {doc.tags.length > 0 && (
            <ul className="flex flex-wrap gap-1.5" aria-label="Tags">
              {doc.tags.map((tag) => (
                <li key={tag.id}>
                  <Link
                    to={`/documents?tags=${tag.id}`}
                    className="inline-flex rounded-full border px-2 py-0.5 text-[11px] text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    {tag.name}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </header>
      <ul className="divide-y border-t">
        {passages.map((passage) => (
          <li key={passage.chunk_id}>
            <Passage documentId={doc.id} passage={passage} pattern={pattern} />
          </li>
        ))}
      </ul>
    </article>
  );
}

export function ResultCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-lg border bg-card" aria-hidden="true">
      <div className="flex gap-3 p-4">
        <Skeleton className="h-14 w-11 shrink-0" />
        <div className="flex flex-1 flex-col gap-2">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-3 w-1/3" />
        </div>
      </div>
      <div className="flex flex-col gap-2 border-t px-4 py-3">
        <Skeleton className="h-3 w-1/4" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-5/6" />
      </div>
    </div>
  );
}
