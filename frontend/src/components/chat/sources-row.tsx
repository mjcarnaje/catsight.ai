import { useState } from "react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { Source } from "@/types";

/** Inline [n] marker in an answer; opens the source on click. */
export function CitationChip({ n, source, onOpen }: { n: number; source?: Source; onOpen: (source: Source) => void }) {
  if (!source) return <span className="text-muted-foreground">[{n}]</span>;
  const pages = [...new Set(source.passages.map((p) => p.page).filter(Boolean))];
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={() => onOpen(source)}
          className="mx-0.5 inline-flex h-[18px] min-w-[18px] -translate-y-px items-center justify-center rounded-[5px] border bg-muted px-1 align-middle font-mono text-[10px] font-medium text-muted-foreground no-underline transition-colors hover:border-foreground/30 hover:text-foreground"
          aria-label={`Source ${n}: ${source.title}`}
        >
          {n}
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs">
        <p className="font-medium">{source.title}</p>
        <p className="text-muted-foreground">
          {[source.reference_number, pages.length ? `p. ${pages.join(", ")}` : null].filter(Boolean).join(" · ")}
        </p>
      </TooltipContent>
    </Tooltip>
  );
}

const CITED = /\[(\d{1,2}(?:\s*,\s*\d{1,2})*)\]/g;

/** Citation numbers used in an answer's text. */
export function citedNumbers(text: string): Set<number> {
  const numbers = new Set<number>();
  for (const match of text.matchAll(CITED)) match[1].split(",").forEach((n) => numbers.add(Number(n.trim())));
  return numbers;
}

/** The documents an answer drew on: cited ones first, the rest of the search results folded away. */
export function SourcesRow({
  sources,
  cited,
  onOpen,
  className,
}: {
  sources: Source[];
  cited?: Set<number>;
  onOpen: (source: Source) => void;
  className?: string;
}) {
  const [showAll, setShowAll] = useState(false);
  if (sources.length === 0) return null;
  const hasCitations = Boolean(cited && cited.size > 0);
  const primary = hasCitations ? sources.filter((s) => cited!.has(s.n)) : sources;
  const others = hasCitations ? sources.filter((s) => !cited!.has(s.n)) : [];
  const visible = showAll ? [...primary, ...others] : primary;

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        {hasCitations ? `${primary.length} cited` : `${sources.length} source${sources.length === 1 ? "" : "s"}`}
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {visible.map((source) => {
          const pages = [...new Set(source.passages.map((p) => p.page).filter(Boolean))];
          return (
            <button
              key={source.id}
              type="button"
              onClick={() => onOpen(source)}
              className={cn(
                "flex items-start gap-2.5 rounded-lg border bg-card px-3 py-2.5 text-left transition-colors hover:border-foreground/20 hover:bg-muted/40",
                hasCitations && !cited!.has(source.n) && "opacity-70"
              )}
            >
              <span className="mt-0.5 grid size-[18px] shrink-0 place-items-center rounded-[5px] border bg-muted font-mono text-[10px] text-muted-foreground">
                {source.n}
              </span>
              <span className="flex min-w-0 flex-col">
                <span className="line-clamp-2 text-[13px] font-medium leading-snug">{source.title}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {[source.reference_number || source.year, pages.length ? `p. ${pages.join(", ")}` : null]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </span>
            </button>
          );
        })}
      </div>
      {others.length > 0 && (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="self-start text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          {showAll ? "Show cited only" : `Show ${others.length} more the search found`}
        </button>
      )}
    </div>
  );
}
