import { CornerDownRight } from "lucide-react";
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";

import { extractorLabel } from "@/components/documents/extractors";
import { Markdown } from "@/components/markdown";
import { FAILED_COLOR, stageOf } from "@/lib/document-stages";
import { formatBytes, formatDate, modelName, plural } from "@/lib/format";
import { isProcessing } from "@/lib/queries";
import { cn } from "@/lib/utils";
import type { DocumentDetail } from "@/types";

function SectionLabel({ children, id }: { children: ReactNode; id?: string }) {
  return (
    <h2 id={id} className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
      {children}
    </h2>
  );
}

/**
 * Summary, the questions the document answers, its facts and its processing history.
 *
 * @example
 * <OverviewTab doc={doc} />
 */
export function OverviewTab({ doc }: { doc: DocumentDetail }) {
  const navigate = useNavigate();
  const title = doc.title || doc.file_name;
  const history = [...doc.status_history].sort((a, b) => a.changed_at.localeCompare(b.changed_at));

  const askAbout = (prompt: string) =>
    navigate("/chat", { state: { prompt, documents: [{ id: doc.id, title }] } });

  const details: [string, ReactNode][] = [
    ["Pages", doc.page_count ? plural(doc.page_count, "page") : "-"],
    ["Passages", doc.chunk_count ? doc.chunk_count.toLocaleString() : "-"],
    ["File size", doc.file_size ? formatBytes(doc.file_size) : "-"],
    ["Extractor", doc.extractor ? extractorLabel(doc.extractor) : "-"],
    ["Summarized by", doc.summarization_model ? modelName(doc.summarization_model) : "-"],
    [
      "Uploaded by",
      doc.uploaded_by ? (
        <>
          {doc.uploaded_by.name}
          {doc.uploaded_by.is_guest && <span className="text-muted-foreground"> (guest)</span>}
        </>
      ) : (
        "-"
      ),
    ],
    ["Uploaded", formatDate(doc.created_at) || "-"],
    ["Processed", doc.processed_at ? formatDate(doc.processed_at, "MMM d, yyyy HH:mm") : "-"],
  ];

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_18rem] lg:gap-10">
      <div className="flex min-w-0 flex-col gap-8">
        <section aria-labelledby="summary-heading" className="flex flex-col gap-3">
          <SectionLabel id="summary-heading">Summary</SectionLabel>
          {doc.summary.trim() ? (
            <Markdown content={doc.summary} className="prose-sm break-words" />
          ) : (
            <p className="text-sm text-muted-foreground">
              {isProcessing(doc) || doc.is_failed
                ? "The summary is written once the document has been read."
                : "This document has no summary."}
            </p>
          )}
        </section>

        {doc.questions.length > 0 && (
          <section aria-labelledby="questions-heading" className="flex flex-col gap-3">
            <SectionLabel id="questions-heading">Questions this document answers</SectionLabel>
            <ul className="flex flex-wrap gap-2">
              {doc.questions.map((question) => (
                <li key={question} className="max-w-full">
                  <button
                    type="button"
                    onClick={() => askAbout(question)}
                    className="group flex max-w-full items-start gap-2 rounded-md border px-3 py-2 text-left text-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <CornerDownRight className="mt-0.5 size-3.5 shrink-0 text-muted-foreground group-hover:text-foreground" aria-hidden />
                    <span className="min-w-0">{question}</span>
                    <span className="sr-only"> - ask in chat</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      <aside className="flex min-w-0 flex-col gap-8">
        <section aria-labelledby="details-heading" className="flex flex-col gap-3">
          <SectionLabel id="details-heading">Details</SectionLabel>
          <dl className="flex flex-col divide-y rounded-lg border text-sm">
            {details.map(([label, value]) => (
              <div key={label} className="flex items-baseline justify-between gap-4 px-3 py-2">
                <dt className="shrink-0 text-muted-foreground">{label}</dt>
                <dd className="min-w-0 truncate text-right">{value}</dd>
              </div>
            ))}
          </dl>
        </section>

        {history.length > 0 && (
          <section aria-labelledby="history-heading" className="flex flex-col gap-3">
            <SectionLabel id="history-heading">History</SectionLabel>
            <ol className="flex flex-col">
              {history.map((event, index) => {
                const stage = stageOf(event.status);
                return (
                  <li key={`${event.status}-${event.changed_at}-${index}`} className="relative flex gap-3 pb-4 last:pb-0">
                    {index < history.length - 1 && (
                      <span aria-hidden className="absolute left-[3px] top-3 h-full w-px bg-border" />
                    )}
                    <span
                      aria-hidden
                      className="relative mt-1.5 size-[7px] shrink-0 rounded-full"
                      style={{ background: event.is_failed ? FAILED_COLOR : stage.color }}
                    />
                    <div className="min-w-0">
                      <p className={cn("text-sm", event.is_failed && "text-destructive")}>
                        {event.is_failed ? `Failed while ${stage.doing.toLowerCase()}` : stage.label}
                      </p>
                      <p className="text-xs text-muted-foreground">{formatDate(event.changed_at, "MMM d, yyyy HH:mm")}</p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>
        )}
      </aside>
    </div>
  );
}
