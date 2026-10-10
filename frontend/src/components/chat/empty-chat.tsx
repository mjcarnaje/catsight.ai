import { CatMark } from "@/components/brand/cat-mark";
import { useDashboard } from "@/lib/queries";
import type { ScopedDocument } from "@/components/chat/document-picker";

const FALLBACK = [
  "What does our travel policy say about per diem?",
  "Who signed the 2023 supplier agreement?",
  "Summarize the board's decisions on the budget this year.",
  "Which documents mention the new office lease?",
];

/** First screen of a new chat: what it can do, plus questions from the library. */
export function EmptyChat({ scope, onPick }: { scope: ScopedDocument[]; onPick: (question: string) => void }) {
  const { data } = useDashboard();
  const fromLibrary = (data?.questions ?? []).map((q) => q.question);
  const suggestions = (fromLibrary.length >= 2 ? fromLibrary : FALLBACK).slice(0, 4);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-8 px-4 py-10">
      <div className="flex flex-col items-center gap-3 text-center">
        <CatMark className="size-10" sparkle={false} />
        <h1 className="text-2xl font-semibold tracking-tight">What would you like to know?</h1>
        <p className="max-w-md text-sm text-muted-foreground">
          {scope.length
            ? `Answers will come only from ${scope.length === 1 ? `“${scope[0].title}”` : `${scope.length} selected documents`}.`
            : "CATSight searches the documents in your library, then answers with numbered citations to the exact pages."}
        </p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {suggestions.map((question) => (
          <button
            key={question}
            type="button"
            onClick={() => onPick(question)}
            className="rounded-xl border bg-card px-4 py-3 text-left text-sm leading-snug text-muted-foreground transition-colors hover:border-foreground/20 hover:text-foreground"
          >
            {question}
          </button>
        ))}
      </div>
    </div>
  );
}
