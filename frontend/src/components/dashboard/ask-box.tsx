import { ArrowUp, CornerDownLeft } from "lucide-react";
import { useState, type FormEvent, type KeyboardEvent } from "react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useConfig } from "@/lib/queries";
import type { Dashboard } from "@/types";

/** The dashboard's way into chat; suggestions come from the library itself. */
export function AskBox({ questions, isLoading }: { questions?: Dashboard["questions"]; isLoading: boolean }) {
  const navigate = useNavigate();
  const { data: config } = useConfig();
  const noProvider = config?.organization?.ai_configured === false;
  const [text, setText] = useState("");

  const ask = (question: string) => {
    if (!noProvider && question.trim()) navigate("/chat", { state: { prompt: question.trim(), send: true } });
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    ask(text);
  };
  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      ask(text);
    }
  };

  return (
    <section className="flex flex-col gap-3">
      <form
        onSubmit={submit}
        className="group rounded-xl border bg-card p-3 shadow-sm transition-colors focus-within:border-ring/50"
      >
        <label htmlFor="dashboard-ask" className="sr-only">
          Ask about the documents
        </label>
        <textarea
          id="dashboard-ask"
          rows={2}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          disabled={noProvider}
          placeholder={noProvider ? "Ask an admin to add an AI provider first." : "Ask about your documents: people, dates, decisions, amounts…"}
          className="block w-full resize-none bg-transparent px-1 text-[15px] leading-relaxed outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
        />
        <div className="flex items-center justify-between gap-3 pt-1">
          <span className="hidden items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground sm:inline-flex">
            <CornerDownLeft className="size-3" /> to ask · answers cite their pages
          </span>
          <Button type="submit" size="icon" className="ml-auto size-8" disabled={!text.trim() || noProvider} aria-label="Ask">
            <ArrowUp />
          </Button>
        </div>
      </form>

      {isLoading ? (
        <div className="flex flex-wrap gap-2">
          {[180, 240, 210].map((w) => (
            <Skeleton key={w} className="h-7 rounded-full" style={{ width: w }} />
          ))}
        </div>
      ) : questions && questions.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {questions.slice(0, 4).map(({ question }) => (
            <button
              key={question}
              type="button"
              onClick={() => ask(question)}
              disabled={noProvider}
              className="max-w-full truncate rounded-full border px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-foreground/20 hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
            >
              {question}
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}
