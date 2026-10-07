import { AlertCircle, ArrowDown, RotateCcw } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";

import { Composer, type ComposerHandle } from "@/components/chat/composer";
import type { ScopedDocument } from "@/components/chat/document-picker";
import { EmptyChat } from "@/components/chat/empty-chat";
import { AssistantAnswer, DraftAnswer, UserBubble } from "@/components/chat/messages";
import { SourceSheet } from "@/components/chat/source-sheet";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useChat } from "@/hooks/use-chat";
import type { Source } from "@/types";

/** Navigation state other pages may pass: a question (sent right away if `send`) and/or a document scope. */
interface ChatNavigationState {
  prompt?: string;
  send?: boolean;
  documents?: ScopedDocument[];
}

const QUOTA_CODES = new Set(["message_limit", "rate_limited"]);
const isSaved = (id: string) => !id.startsWith("pending-") && !id.startsWith("stopped-");

export default function ChatPage() {
  const { id } = useParams();
  const chatId = id ? Number(id) : undefined;
  const location = useLocation();
  const navigate = useNavigate();
  const chat = useChat(chatId);
  const [input, setInput] = useState("");
  const [scope, setScope] = useState<ScopedDocument[]>([]);
  const [openSource, setOpenSource] = useState<Source | null>(null);
  const composer = useRef<ComposerHandle>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const [atBottom, setAtBottom] = useState(true);
  const documentIds = scope.map((d) => d.id);

  // A new chat starts unscoped; a saved one restores its scope
  useEffect(() => {
    if (chatId === undefined) setScope([]);
  }, [chatId]);
  useEffect(() => {
    if (chat.savedScope) setScope(chat.savedScope);
  }, [chat.savedScope]);

  // Questions and scopes handed over by the dashboard, search or a document page (once per navigation)
  const consumed = useRef<string | null>(null);
  useEffect(() => {
    const state = location.state as ChatNavigationState | null;
    if (!state || consumed.current === location.key) return;
    consumed.current = location.key;
    navigate(location.pathname, { replace: true, state: null });
    const documents = state.documents ?? [];
    setScope(documents);
    if (state.prompt && state.send) chat.send(state.prompt, { documentIds: documents.map((d) => d.id) });
    else if (state.prompt) setInput(state.prompt);
    composer.current?.focus();
  }, [location, navigate, chat]);

  const send = useCallback(
    (text = input) => {
      if (!text.trim()) return;
      chat.send(text, { documentIds });
      setInput("");
      setAtBottom(true);
    },
    [chat, documentIds, input]
  );

  // Stay pinned to the newest content while answering, unless the reader scrolled up
  const onScroll = () => {
    const el = scroller.current;
    if (el) setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 80);
  };
  useLayoutEffect(() => {
    if (atBottom) scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
  }, [chat.messages, chat.draft, chat.error, atBottom]);

  const lastAnswerIndex = chat.messages.map((m) => m.role).lastIndexOf("assistant");
  const hasConversation = chat.messages.length > 0 || chat.draft !== null;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div ref={scroller} onScroll={onScroll} className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        {chat.loading ? (
          <ConversationSkeleton />
        ) : !hasConversation && !chat.error ? (
          <EmptyChat scope={scope} onPick={(question) => send(question)} />
        ) : (
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 pb-10 pt-8">
            {chat.messages.map((message, index) =>
              message.role === "user" ? (
                <UserBubble
                  key={message.id}
                  message={message}
                  canEdit={!chat.streaming && isSaved(message.id)}
                  onEdit={(text) => chat.send(text, { replaceFrom: message.id, documentIds })}
                />
              ) : (
                <AssistantAnswer
                  key={message.id}
                  message={message}
                  onOpenSource={setOpenSource}
                  onRegenerate={
                    index === lastAnswerIndex && !chat.streaming && index > 0 && isSaved(chat.messages[index - 1].id)
                      ? () => chat.regenerate(chat.messages[index - 1].id, documentIds)
                      : undefined
                  }
                />
              )
            )}
            {chat.draft && <DraftAnswer draft={chat.draft} onOpenSource={setOpenSource} />}
            {chat.error && (
              <div role="alert" className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm">
                <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
                <div className="flex flex-1 flex-col gap-2">
                  <p>{chat.error.detail}</p>
                  <div className="flex gap-2">
                    {chat.error.question && !QUOTA_CODES.has(chat.error.code ?? "") && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => chat.send(chat.error!.question, { replaceFrom: chat.error!.replaceFrom, documentIds })}
                      >
                        <RotateCcw />
                        Try again
                      </Button>
                    )}
                    {QUOTA_CODES.has(chat.error.code ?? "") && (
                      <Button asChild size="sm" variant="outline">
                        <Link to="/search">Browse with search instead</Link>
                      </Button>
                    )}
                    {!chat.error.question && (
                      <Button asChild size="sm" variant="outline">
                        <Link to="/chat">Start a new chat</Link>
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="relative mx-auto w-full max-w-3xl px-4 pb-4">
        {!atBottom && hasConversation && (
          <Button
            variant="outline"
            size="sm"
            className="absolute -top-11 left-1/2 h-8 -translate-x-1/2 rounded-full bg-background shadow-sm"
            onClick={() => {
              setAtBottom(true);
              scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
            }}
          >
            <ArrowDown />
            Latest
          </Button>
        )}
        <Composer
          ref={composer}
          value={input}
          onChange={setInput}
          onSend={() => send()}
          onStop={chat.stop}
          streaming={chat.streaming}
          scope={scope}
          onScopeChange={setScope}
          hasMessages={hasConversation}
        />
      </div>

      <SourceSheet source={openSource} onClose={() => setOpenSource(null)} />
    </div>
  );
}

function ConversationSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 pt-8">
      <Skeleton className="ml-auto h-10 w-2/5 rounded-2xl" />
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-11/12" />
        <Skeleton className="h-4 w-3/5" />
      </div>
    </div>
  );
}
