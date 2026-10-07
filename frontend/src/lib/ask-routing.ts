/**
 * Where a question typed into the dashboard's "Ask CATSight" bar should go.
 *
 *  - `/search?query=…` runs semantic search across every document and lists
 *    the matching passages (fast, no LLM call, good for finding a file).
 *  - `/chat` opens a new conversation with the text pre-filled via
 *    `state.prompt` (slower, but answers in prose with citations).
 */
export type AskDestination =
  | { pathname: "/search"; search: string }
  | { pathname: "/chat"; state: { prompt: string } };

export function resolveAskDestination(query: string): AskDestination {
  const trimmed = query.trim();

  // TODO: decide when a query should open a chat instead of a search.
  // Ideas: question words ("what", "how", "ano", "unsa"…), a trailing "?",
  // imperative verbs ("summarize", "explain", "compare"), or query length.
  // Return { pathname: "/chat", state: { prompt: trimmed } } for those.

  return { pathname: "/search", search: `?query=${encodeURIComponent(trimmed)}` };
}
