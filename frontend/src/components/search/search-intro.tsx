import { CornerDownRight } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { useDashboard } from "@/lib/queries";

const KEYWORD_EXAMPLES = ["Special Order 01592-2023", "travel order Zamboanga", "cash incentive poster presentation"];

function SectionLabel({ children }: { children: string }) {
  return <h2 className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{children}</h2>;
}

function Suggestion({ text, mono = false, onPick }: { text: string; mono?: boolean; onPick: (query: string) => void }) {
  return (
    <li>
      <button
        type="button"
        onClick={() => onPick(text)}
        className="group flex w-full items-start gap-2 rounded-md px-2 py-2 text-left text-sm outline-none transition-colors hover:bg-accent focus-visible:ring-1 focus-visible:ring-ring"
      >
        <CornerDownRight className="mt-0.5 size-3.5 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground" />
        <span className={mono ? "break-words font-mono text-[13px]" : "break-words"}>{text}</span>
      </button>
    </li>
  );
}

/** Shown before the first search: what the search does, and queries to start from. */
export function SearchIntro({ onPick }: { onPick: (query: string) => void }) {
  const { data, isPending } = useDashboard();
  const questions = data?.questions ?? [];
  const showQuestions = isPending || questions.length > 0;

  return (
    <section aria-label="Getting started" className="flex flex-col gap-8 pt-2">
      <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
        Looks for the exact words and for similar meaning at the same time, across every page of every document. Phrase
        it as a question and you also get a short answer that cites its sources.
      </p>
      <div className={showQuestions ? "grid gap-8 md:grid-cols-2" : "grid gap-8"}>
        {showQuestions && (
          <div className="flex flex-col gap-2">
            <SectionLabel>Ask a question</SectionLabel>
            {isPending ? (
              <div className="flex flex-col gap-3 px-2 py-2" aria-hidden="true">
                <Skeleton className="h-4 w-11/12" />
                <Skeleton className="h-4 w-4/5" />
                <Skeleton className="h-4 w-10/12" />
              </div>
            ) : (
              <ul className="-mx-2 flex flex-col">
                {questions.map((item) => (
                  <Suggestion key={`${item.document_id}-${item.question}`} text={item.question} onPick={onPick} />
                ))}
              </ul>
            )}
          </div>
        )}
        <div className="flex flex-col gap-2">
          <SectionLabel>Search by keyword</SectionLabel>
          <ul className="-mx-2 flex flex-col">
            {KEYWORD_EXAMPLES.map((text) => (
              <Suggestion key={text} text={text} mono onPick={onPick} />
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
