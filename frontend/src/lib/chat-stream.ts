/**
 * Client for POST /api/chats/stream/ (Server-Sent Events over fetch, so the
 * request can carry a JSON body and an Authorization header).
 * Event names and payloads are documented in backend/app/views/chat.py.
 */
import { authHeaders, refreshAccessToken } from "@/lib/api";
import type { AssistantMessage, Chat, Source, UserMessage } from "@/types";

export interface StreamRequest {
  question: string;
  chat_id?: number;
  document_ids?: number[];
  /** Delete this question and everything after it first (regenerate / edit). */
  replace_from?: string;
}

export interface StreamHandlers {
  onStart?: (data: { chat: Chat; question: UserMessage }) => void;
  onSearch?: (query: string) => void;
  onSources?: (sources: Source[]) => void;
  onToken?: (id: string, text: string) => void;
  onAnswer?: (message: AssistantMessage) => void;
  onTitle?: (title: string) => void;
  onError?: (detail: string, code?: string) => void;
}

export class StreamError extends Error {
  constructor(message: string, readonly code?: string) {
    super(message);
  }
}

async function post(body: StreamRequest, signal: AbortSignal, retried = false): Promise<Response> {
  const response = await fetch("/api/chats/stream/", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(body),
    signal,
  });
  if (response.status === 401 && !retried && (await refreshAccessToken())) {
    return post(body, signal, true);
  }
  return response;
}

function dispatch(event: string, data: any, handlers: StreamHandlers) {
  switch (event) {
    case "start":
      return handlers.onStart?.(data);
    case "search":
      return handlers.onSearch?.(data.query);
    case "sources":
      return handlers.onSources?.(data.sources);
    case "token":
      return handlers.onToken?.(data.id, data.text);
    case "answer":
      return handlers.onAnswer?.(data.message);
    case "title":
      return handlers.onTitle?.(data.title);
    case "error":
      return handlers.onError?.(data.detail, data.code);
  }
}

/** Streams one answer; resolves when the server sends `done` or the signal aborts. */
export async function streamChat(body: StreamRequest, handlers: StreamHandlers, signal: AbortSignal) {
  const response = await post(body, signal);
  if (!response.ok || !response.body) {
    let detail = "The answer couldn't be started. Try again.";
    let code: string | undefined;
    try {
      const data = await response.json();
      detail = data.detail ?? detail;
      code = data.code;
    } catch {
      /* not JSON */
    }
    throw new StreamError(detail, code ?? (response.status === 429 ? "rate_limited" : undefined));
  }

  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += value;
    const frames = buffer.split("\n\n");
    buffer = frames.pop() ?? "";
    for (const frame of frames) {
      const event = /^event: (.+)$/m.exec(frame)?.[1];
      const data = /^data: (.*)$/m.exec(frame)?.[1];
      if (!event || data === undefined) continue;
      if (event === "done") return;
      dispatch(event, JSON.parse(data), handlers);
    }
  }
}
