import { ArrowUpRight, FileText } from "lucide-react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { Source } from "@/types";

/** The passages an answer cited from one document, with a way into the document. */
export function SourceSheet({ source, onClose }: { source: Source | null; onClose: () => void }) {
  const firstPage = source?.passages.find((p) => p.page)?.page;
  return (
    <Sheet open={Boolean(source)} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        {source && (
          <>
            <SheetHeader className="space-y-1.5 border-b p-5 pr-12 text-left">
              <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Source [{source.n}]</p>
              <SheetTitle className="text-base leading-snug">{source.title}</SheetTitle>
              <SheetDescription>
                {[source.reference_number, source.year, source.page_count ? `${source.page_count} pages` : null]
                  .filter(Boolean)
                  .join(" · ")}
              </SheetDescription>
              <div className="pt-2">
                <Button asChild size="sm" variant="outline">
                  <Link to={`/documents/${source.id}${firstPage ? `?page=${firstPage}` : ""}`} onClick={onClose}>
                    <FileText />
                    Open document
                    <ArrowUpRight />
                  </Link>
                </Button>
              </div>
            </SheetHeader>
            <div className="flex-1 overflow-y-auto p-5">
              <p className="mb-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                Passages the answer read
              </p>
              <ol className="flex flex-col gap-4">
                {source.passages.map((passage) => (
                  <li key={passage.chunk_id} className="flex flex-col gap-1.5">
                    <span className="text-xs text-muted-foreground">
                      {[passage.page ? `Page ${passage.page}` : null, passage.section].filter(Boolean).join(" · ") || "Passage"}
                    </span>
                    <blockquote className="whitespace-pre-wrap rounded-md border-l-2 border-gold/60 bg-muted/40 px-3 py-2 text-[13px] leading-relaxed">
                      {passage.text}
                    </blockquote>
                  </li>
                ))}
              </ol>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
