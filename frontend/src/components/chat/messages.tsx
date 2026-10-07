import { Check, Copy, Loader2, Pencil, RotateCcw, Search } from "lucide-react";
import { useState, type ReactNode } from "react";

import { citedNumbers, CitationChip, SourcesRow } from "@/components/chat/sources-row";
import { Markdown } from "@/components/markdown";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Draft, LocalAssistantMessage } from "@/hooks/use-chat";
import { cn } from "@/lib/utils";
import type { Source, UserMessage } from "@/types";

function IconAction({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-foreground" onClick={onClick} aria-label={label}>
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function CopyAction({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <IconAction
      label={copied ? "Copied" : "Copy"}
      onClick={() =>
        navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        })
      }
    >
      {copied ? <Check /> : <Copy />}
    </IconAction>
  );
}

/** Answer text with its [n] markers turned into source chips. */
function AnswerText({ text, sources, onOpenSource }: { text: string; sources: Source[]; onOpenSource: (s: Source) => void }) {
  const byNumber = new Map(sources.map((s) => [s.n, s]));
  return (
    <Markdown
      content={text}
      className="text-[15px]"
      renderCitation={(n) => <CitationChip n={n} source={byNumber.get(n)} onOpen={onOpenSource} />}
    />
  );
}

function Searches({ searches, sources, active }: { searches: string[]; sources: Source[]; active?: boolean }) {
  if (searches.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
      {active ? <Loader2 className="size-3.5 animate-spin" /> : <Search className="size-3.5" />}
      <span>
        {active ? "Searching for " : "Searched for "}
        {searches.map((q, i) => (
          <span key={i}>
            {i > 0 && ", "}
            <span className="text-foreground/80">“{q}”</span>
          </span>
        ))}
        {!active || sources.length ? ` · ${sources.length} document${sources.length === 1 ? "" : "s"}` : ""}
      </span>
    </div>
  );
}

export function UserBubble({
  message,
  canEdit,
  onEdit,
}: {
  message: UserMessage;
  canEdit: boolean;
  onEdit: (text: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(message.content);

  if (editing) {
    return (
      <form
        className="ml-auto flex w-full max-w-[85%] flex-col gap-2 rounded-2xl border bg-card p-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (text.trim()) {
            setEditing(false);
            onEdit(text.trim());
          }
        }}
      >
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={Math.min(8, Math.max(2, text.split("\n").length))}
          autoFocus
          className="w-full resize-none bg-transparent text-[15px] leading-relaxed outline-none"
          aria-label="Edit question"
          onKeyDown={(e) => e.key === "Escape" && setEditing(false)}
        />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}>
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={!text.trim()}>
            Send
          </Button>
        </div>
      </form>
    );
  }

  return (
    <div className="group flex flex-col items-end gap-1">
      <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-secondary px-4 py-2.5 text-[15px] leading-relaxed">
        {message.content}
      </div>
      <div className="flex opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
        <CopyAction text={message.content} />
        {canEdit && (
          <IconAction label="Edit" onClick={() => { setText(message.content); setEditing(true); }}>
            <Pencil />
          </IconAction>
        )}
      </div>
    </div>
  );
}

export function AssistantAnswer({
  message,
  onOpenSource,
  onRegenerate,
}: {
  message: LocalAssistantMessage;
  onOpenSource: (s: Source) => void;
  onRegenerate?: () => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <Searches searches={message.searches} sources={message.sources} />
      <AnswerText text={message.content} sources={message.sources} onOpenSource={onOpenSource} />
      {message.stopped && <p className="text-xs italic text-muted-foreground">Stopped. This partial answer isn't saved.</p>}
      <SourcesRow sources={message.sources} cited={citedNumbers(message.content)} onOpen={onOpenSource} className="mt-1" />
      <div className="-ml-1.5 flex">
        <CopyAction text={message.content} />
        {onRegenerate && (
          <IconAction label="Regenerate" onClick={onRegenerate}>
            <RotateCcw />
          </IconAction>
        )}
      </div>
    </div>
  );
}

/** The answer being streamed, with what the agent is doing right now. */
export function DraftAnswer({ draft, onOpenSource }: { draft: Draft; onOpenSource: (s: Source) => void }) {
  return (
    <div className="flex flex-col gap-3" aria-live="polite">
      <Searches searches={draft.searches} sources={draft.sources} active={draft.phase === "searching"} />
      {draft.phase === "thinking" && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="size-1.5 animate-pulse rounded-full bg-gold" />
          Reading your question…
        </p>
      )}
      {draft.phase === "writing" && (
        <div className={cn("relative")}>
          <AnswerText text={draft.text} sources={draft.sources} onOpenSource={onOpenSource} />
          <span className="ml-0.5 inline-block h-4 w-[2px] translate-y-0.5 animate-caret bg-foreground/70" aria-hidden="true" />
        </div>
      )}
    </div>
  );
}
