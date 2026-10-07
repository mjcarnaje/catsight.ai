import { ArrowUp, Sparkles } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";

import { badgeVariants } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { resolveAskDestination } from "@/lib/ask-routing";
import { cn } from "@/lib/utils";

const SUGGESTIONS = [
  "Summarize the latest memo",
  "Documents about scholarships",
  "What changed in the student handbook?",
];

/** The dashboard's entry point into search and chat. */
export function AskBar() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");

  const ask = (text: string) => {
    if (!text.trim()) return;
    const destination = resolveAskDestination(text);
    if (destination.pathname === "/chat") {
      navigate("/chat", { state: destination.state });
    } else {
      navigate({ pathname: destination.pathname, search: destination.search });
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    ask(query);
  };

  return (
    <div className="flex flex-col gap-3">
      <form
        onSubmit={onSubmit}
        className="flex items-center gap-2 rounded-xl border bg-card p-2 pl-4 shadow-sm transition-shadow focus-within:border-ring/40 focus-within:shadow-md"
      >
        <Sparkles className="size-4 shrink-0 text-primary" aria-hidden="true" />
        <label htmlFor="ask-catsight" className="sr-only">
          Ask CATSight about your documents
        </label>
        <input
          id="ask-catsight"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ask CATSight about your documents…"
          autoComplete="off"
          className="h-9 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        <Button type="submit" size="icon" className="size-8 shrink-0" disabled={!query.trim()} aria-label="Ask">
          <ArrowUp />
        </Button>
      </form>
      <div className="flex flex-wrap gap-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => ask(s)}
            className={cn(
              badgeVariants({ variant: "outline" }),
              "font-normal text-muted-foreground hover:bg-accent hover:text-foreground"
            )}
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
