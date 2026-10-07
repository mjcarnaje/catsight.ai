import { useQuery } from "@tanstack/react-query";
import { AlertCircle, Layers, Search, SearchX } from "lucide-react";
import { useDeferredValue, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { documentsApi, errorMessage } from "@/lib/api";
import { plural } from "@/lib/format";
import { keys } from "@/lib/queries";

const STEP = 50;

/**
 * The passages the document was split into for search, with a filter box. A page number
 * links to that page in the PDF tab.
 *
 * @example
 * <PassagesTab documentId={doc.id} processing={isProcessing(doc)} />
 */
export function PassagesTab({ documentId, processing }: { documentId: number; processing: boolean }) {
  const chunks = useQuery({ queryKey: keys.documentChunks(documentId), queryFn: () => documentsApi.chunks(documentId) });
  const [filter, setFilter] = useState("");
  const [shown, setShown] = useState(STEP);
  const needle = useDeferredValue(filter.trim().toLowerCase());

  const matches = useMemo(() => {
    const all = chunks.data ?? [];
    if (!needle) return all;
    return all.filter((chunk) => chunk.text.toLowerCase().includes(needle) || chunk.section.toLowerCase().includes(needle));
  }, [chunks.data, needle]);

  if (chunks.isPending) {
    return (
      <div className="flex flex-col gap-3" aria-label="Loading passages">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (chunks.isError) {
    return (
      <EmptyState
        icon={AlertCircle}
        title="Couldn't load the passages"
        description={errorMessage(chunks.error)}
        action={
          <Button variant="outline" size="sm" onClick={() => chunks.refetch()}>
            Try again
          </Button>
        }
      />
    );
  }

  if (chunks.data.length === 0) {
    return (
      <EmptyState
        icon={Layers}
        title="No passages yet"
        description={
          processing
            ? "Passages appear once the document has been indexed."
            : "This document has no indexed passages."
        }
      />
    );
  }

  const visible = matches.slice(0, shown);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative sm:w-80">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Label htmlFor="passage-filter" className="sr-only">
            Filter passages
          </Label>
          <Input
            id="passage-filter"
            type="search"
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value);
              setShown(STEP);
            }}
            placeholder="Filter passages"
            autoComplete="off"
            className="h-8 pl-8 text-sm shadow-none"
          />
        </div>
        <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground" aria-live="polite">
          {needle ? `${matches.length.toLocaleString()} of ${chunks.data.length.toLocaleString()}` : plural(chunks.data.length, "passage")}
        </p>
      </div>

      {matches.length === 0 ? (
        <EmptyState icon={SearchX} title="No passages match" description="Try a different word or phrase." />
      ) : (
        <>
          <ol className="divide-y overflow-hidden rounded-lg border bg-card">
            {visible.map((chunk) => (
              <li key={chunk.id} className="flex flex-col gap-2 px-4 py-3">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span className="font-mono text-[11px] text-foreground">#{chunk.index}</span>
                  {chunk.page != null && (
                    <Link
                      to={`/documents/${documentId}?tab=pdf&page=${chunk.page}`}
                      className="font-mono text-[11px] underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    >
                      p. {chunk.page}
                    </Link>
                  )}
                  {chunk.section && <span className="min-w-0 truncate">{chunk.section}</span>}
                </div>
                <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{chunk.text}</p>
              </li>
            ))}
          </ol>
          {matches.length > shown && (
            <Button variant="outline" size="sm" className="self-center shadow-none" onClick={() => setShown((n) => n + STEP)}>
              Show more ({(matches.length - shown).toLocaleString()} left)
            </Button>
          )}
        </>
      )}
    </div>
  );
}
