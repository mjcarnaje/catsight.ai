import { ArrowUp, FileText, Square, X } from "lucide-react";
import { forwardRef, useEffect, useImperativeHandle, useRef, type KeyboardEvent } from "react";

import { DocumentPicker, type ScopedDocument } from "@/components/chat/document-picker";
import { Button } from "@/components/ui/button";
import { useConfig } from "@/lib/queries";
import { cn } from "@/lib/utils";

const MAX_CHARS = 2000;

export interface ComposerHandle {
  focus: () => void;
}

interface ComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onStop: () => void;
  streaming: boolean;
  scope: ScopedDocument[];
  onScopeChange: (documents: ScopedDocument[]) => void;
  hasMessages: boolean;
}

export const Composer = forwardRef<ComposerHandle, ComposerProps>(function Composer(
  { value, onChange, onSend, onStop, streaming, scope, onScopeChange, hasMessages },
  ref
) {
  const textarea = useRef<HTMLTextAreaElement>(null);
  const { data: config } = useConfig();
  useImperativeHandle(ref, () => ({ focus: () => textarea.current?.focus() }));

  // Grow with the text, up to ~8 lines
  useEffect(() => {
    const el = textarea.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 220)}px`;
    el.style.overflowY = el.scrollHeight > 220 ? "auto" : "hidden";
  }, [value]);

  const messages = config?.usage?.limited ? config.usage.messages : null;
  const left = messages ? Math.max(messages.limit - messages.used, 0) : null;
  const outOfQuestions = left === 0;
  const tooLong = value.length > MAX_CHARS;
  const canSend = Boolean(value.trim()) && !streaming && !tooLong && !outOfQuestions;

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      if (canSend) onSend();
    }
    if (e.key === "Escape" && streaming) onStop();
  };

  return (
    <div className="flex flex-col gap-2">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (canSend) onSend();
        }}
        className="rounded-2xl border bg-card shadow-sm transition-colors focus-within:border-ring/50"
      >
        {scope.length > 0 && (
          <div className="flex flex-wrap gap-1.5 px-3 pt-3">
            {scope.map((doc) => (
              <span key={doc.id} className="inline-flex max-w-[16rem] items-center gap-1.5 rounded-md border bg-muted/50 py-0.5 pl-2 pr-1 text-xs">
                <FileText className="size-3 shrink-0 text-muted-foreground" />
                <span className="truncate">{doc.title}</span>
                <button
                  type="button"
                  onClick={() => onScopeChange(scope.filter((d) => d.id !== doc.id))}
                  className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                  aria-label={`Stop limiting to ${doc.title}`}
                >
                  <X className="size-3" />
                </button>
              </span>
            ))}
          </div>
        )}
        <label htmlFor="chat-input" className="sr-only">
          Your question
        </label>
        <textarea
          id="chat-input"
          ref={textarea}
          rows={1}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={
            outOfQuestions
              ? "You've used today's questions. Come back tomorrow!"
              : hasMessages
                ? "Ask a follow-up…"
                : "Ask about special orders, resolutions, designations, travel…"
          }
          disabled={outOfQuestions}
          className="block max-h-[220px] w-full resize-none bg-transparent px-4 pb-1 pt-3.5 text-[15px] leading-relaxed outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
        />
        <div className="flex items-center gap-2 p-2 pl-3">
          <DocumentPicker selected={scope} onChange={onScopeChange}>
            <Button type="button" variant="ghost" size="sm" className="h-8 gap-1.5 px-2 text-muted-foreground">
              <FileText />
              {scope.length ? `${scope.length} document${scope.length === 1 ? "" : "s"}` : "All documents"}
            </Button>
          </DocumentPicker>
          <span className={cn("ml-auto text-xs tabular-nums", tooLong ? "text-destructive" : "text-muted-foreground")}>
            {value.length > MAX_CHARS * 0.8 ? `${value.length} / ${MAX_CHARS}` : ""}
          </span>
          {streaming ? (
            <Button type="button" size="icon" className="size-8 rounded-lg" onClick={onStop} aria-label="Stop answering">
              <Square className="!size-3 fill-current" />
            </Button>
          ) : (
            <Button type="submit" size="icon" className="size-8 rounded-lg" disabled={!canSend} aria-label="Send">
              <ArrowUp />
            </Button>
          )}
        </div>
      </form>
      <p className="px-2 text-center text-xs text-muted-foreground">
        Answers come only from the documents and cite their pages; check important details in the source.
        {left !== null && left > 0 && ` · ${left} question${left === 1 ? "" : "s"} left today`}
      </p>
    </div>
  );
});
