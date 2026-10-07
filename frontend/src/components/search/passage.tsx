import { ArrowUpRight } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { Highlight } from "@/components/search/highlight";
import { snippet, tidy } from "@/components/search/query-text";
import { passageText } from "@/lib/format";
import type { SearchPassage } from "@/types";

const LABELS = { keyword: "exact match", vector: "related meaning" } as const;
const SNIPPET_CHARS = 300;

/** One matching passage: where it is, how it matched, and its text with the query's terms marked. */
export function Passage({
  documentId,
  passage,
  pattern,
}: {
  documentId: number;
  passage: SearchPassage;
  pattern: RegExp | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const full = useMemo(() => tidy(passageText(passage.text, passage.section)), [passage.text, passage.section]);
  const view = useMemo(
    () => (expanded ? { text: full, before: false, after: false } : snippet(full, pattern, SNIPPET_CHARS)),
    [expanded, full, pattern]
  );
  const collapsible = full.length > SNIPPET_CHARS;
  const to = `/documents/${documentId}${passage.page !== null ? `?page=${passage.page}` : ""}`;
  const matched = passage.matched.map((leg) => LABELS[leg]).join(" · ");

  return (
    <div className="flex flex-col gap-1.5 px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <Link
          to={to}
          className="group inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-sm text-xs text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring"
        >
          <span className="shrink-0 font-mono">{passage.page !== null ? `p. ${passage.page}` : "Passage"}</span>
          {passage.section && <span className="truncate">{passage.section}</span>}
          <ArrowUpRight className="size-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" />
        </Link>
        {matched && <span className="font-mono text-[10px] text-muted-foreground/80">{matched}</span>}
      </div>
      <p className="whitespace-pre-line break-words text-sm leading-relaxed text-foreground/90">
        {view.before && <span aria-hidden="true">… </span>}
        <Highlight text={view.text} pattern={pattern} />
        {view.after && <span aria-hidden="true"> …</span>}
      </p>
      {collapsible && (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
          className="w-fit rounded-sm text-xs text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring"
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      )}
    </div>
  );
}
