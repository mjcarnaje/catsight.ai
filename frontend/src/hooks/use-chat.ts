import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useReducer, useRef } from "react";
import { useNavigate } from "react-router-dom";

import { chatsApi, errorMessage } from "@/lib/api";
import { StreamError, streamChat } from "@/lib/chat-stream";
import { keys } from "@/lib/queries";
import type { AssistantMessage, ChatMessage, Source, UserMessage } from "@/types";

/** The answer being written right now. */
export interface Draft {
  phase: "thinking" | "searching" | "writing";
  text: string;
  searches: string[];
  sources: Source[];
}

export interface ChatError {
  detail: string;
  code?: string;
  /** What to resend on retry. */
  question: string;
  /** The saved question to replace on retry (it reached the server). */
  replaceFrom?: string;
}

/** An answer the user stopped part-way; kept on screen, not saved by the server. */
export type LocalAssistantMessage = AssistantMessage & { stopped?: boolean };
export type DisplayMessage = UserMessage | LocalAssistantMessage;

interface State {
  messages: DisplayMessage[];
  /** Documents the saved chat is limited to (from its history). */
  savedScope: { id: number; title: string }[] | null;
  draft: Draft | null;
  streaming: boolean;
  loading: boolean;
  error: ChatError | null;
}

type Action =
  | { type: "reset" }
  | { type: "loading" }
  | { type: "loaded"; messages: ChatMessage[]; scope: { id: number; title: string }[] }
  | { type: "load-failed"; detail: string }
  | { type: "ask"; question: UserMessage; truncateFrom?: string }
  | { type: "saved-question"; tempId: string; question: UserMessage }
  | { type: "search"; query: string }
  | { type: "sources"; sources: Source[] }
  | { type: "token"; text: string }
  | { type: "answer"; message: AssistantMessage }
  | { type: "stop" }
  | { type: "error"; error: ChatError }
  | { type: "done" }
  | { type: "dismiss-error" };

const initial: State = { messages: [], savedScope: null, draft: null, streaming: false, loading: false, error: null };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "reset":
      return initial;
    case "loading":
      return { ...initial, loading: true };
    case "loaded":
      return { ...initial, messages: action.messages, savedScope: action.scope };
    case "load-failed":
      return { ...initial, error: { detail: action.detail, question: "" } };
    case "ask": {
      const cut = action.truncateFrom ? state.messages.findIndex((m) => m.id === action.truncateFrom) : -1;
      const kept = cut >= 0 ? state.messages.slice(0, cut) : state.messages;
      return {
        ...state,
        messages: [...kept, action.question],
        draft: { phase: "thinking", text: "", searches: [], sources: [] },
        streaming: true,
        error: null,
      };
    }
    case "saved-question":
      return { ...state, messages: state.messages.map((m) => (m.id === action.tempId ? action.question : m)) };
    case "search":
      // Any text before a search was the model thinking aloud; the answer comes after
      return state.draft
        ? { ...state, draft: { ...state.draft, phase: "searching", text: "", searches: [...state.draft.searches, action.query] } }
        : state;
    case "sources":
      return state.draft ? { ...state, draft: { ...state.draft, sources: action.sources } } : state;
    case "token":
      return state.draft ? { ...state, draft: { ...state.draft, phase: "writing", text: state.draft.text + action.text } } : state;
    case "answer":
      return { ...state, messages: [...state.messages, action.message], draft: null };
    case "stop": {
      const draft = state.draft;
      const partial: LocalAssistantMessage[] =
        draft && draft.text.trim()
          ? [{ id: `stopped-${Date.now()}`, role: "assistant", content: draft.text, searches: draft.searches, sources: draft.sources, stopped: true }]
          : [];
      return { ...state, messages: [...state.messages, ...partial], draft: null, streaming: false };
    }
    case "error":
      return { ...state, draft: null, streaming: false, error: action.error };
    case "done":
      return { ...state, draft: null, streaming: false };
    case "dismiss-error":
      return { ...state, error: null };
  }
}

interface SendOptions {
  documentIds?: number[];
  /** Replace this saved question and everything after it (regenerate / edit). */
  replaceFrom?: string;
}

/**
 * Everything the chat page needs: history, the streaming answer, stop,
 * regenerate and edit. `chatId` is undefined for a new chat; the first answer
 * creates it and the URL moves to /chat/:id without reloading anything.
 */
export function useChat(chatId: number | undefined) {
  const [state, dispatch] = useReducer(reducer, initial);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const abort = useRef<AbortController | null>(null);
  const createdHere = useRef<number | null>(null);

  // Load (or clear) the conversation when the chat changes
  useEffect(() => {
    if (chatId !== undefined && chatId === createdHere.current) return; // we just created it
    abort.current?.abort();
    createdHere.current = null;
    if (chatId === undefined) {
      dispatch({ type: "reset" });
      return;
    }
    let cancelled = false;
    dispatch({ type: "loading" });
    chatsApi
      .messages(chatId)
      .then(
        (history) =>
          !cancelled &&
          dispatch({
            type: "loaded",
            messages: history.messages,
            scope: history.scope.map((d) => ({ id: d.id, title: d.title || d.file_name })),
          })
      )
      .catch((error) => !cancelled && dispatch({ type: "load-failed", detail: errorMessage(error, "This chat couldn't be loaded.") }));
    return () => {
      cancelled = true;
    };
  }, [chatId]);

  useEffect(() => () => abort.current?.abort(), []);

  const send = useCallback(
    async (question: string, options: SendOptions = {}) => {
      const text = question.trim();
      if (!text && !options.replaceFrom) return;
      abort.current?.abort();
      const controller = new AbortController();
      abort.current = controller;

      const tempId = `pending-${Date.now()}`;
      dispatch({ type: "ask", question: { id: tempId, role: "user", content: text }, truncateFrom: options.replaceFrom });
      let savedQuestion: string | undefined;

      try {
        await streamChat(
          { question: text, chat_id: chatId ?? createdHere.current ?? undefined, document_ids: options.documentIds, replace_from: options.replaceFrom },
          {
            onStart: ({ chat, question: saved }) => {
              savedQuestion = saved.id;
              dispatch({ type: "saved-question", tempId, question: saved });
              if (chatId === undefined && createdHere.current === null) {
                createdHere.current = chat.id;
                navigate(`/chat/${chat.id}`, { replace: true });
                queryClient.invalidateQueries({ queryKey: ["chats"] });
              }
            },
            onSearch: (query) => dispatch({ type: "search", query }),
            onSources: (sources) => dispatch({ type: "sources", sources }),
            onToken: (_id, chunk) => dispatch({ type: "token", text: chunk }),
            onAnswer: (message) => dispatch({ type: "answer", message }),
            onTitle: () => queryClient.invalidateQueries({ queryKey: ["chats"] }),
            onError: (detail, code) =>
              dispatch({ type: "error", error: { detail, code, question: text, replaceFrom: savedQuestion } }),
          },
          controller.signal
        );
        dispatch({ type: "done" });
      } catch (error) {
        if (controller.signal.aborted) return; // stopped by the user or by leaving the chat
        const detail = error instanceof StreamError ? error.message : errorMessage(error, "The connection dropped. Try again.");
        const code = error instanceof StreamError ? error.code : undefined;
        dispatch({ type: "error", error: { detail, code, question: text, replaceFrom: savedQuestion } });
      } finally {
        queryClient.invalidateQueries({ queryKey: keys.config }); // remaining questions
        queryClient.invalidateQueries({ queryKey: ["chats"] });
      }
    },
    [chatId, navigate, queryClient]
  );

  const stop = useCallback(() => {
    abort.current?.abort();
    dispatch({ type: "stop" });
  }, []);

  /** Ask the question at `questionId` again, replacing its answer. */
  const regenerate = useCallback(
    (questionId: string, documentIds?: number[]) => {
      const question = state.messages.find((m) => m.id === questionId);
      if (question) send(question.content, { replaceFrom: questionId, documentIds });
    },
    [send, state.messages]
  );

  return { ...state, send, stop, regenerate, dismissError: () => dispatch({ type: "dismiss-error" }) };
}
