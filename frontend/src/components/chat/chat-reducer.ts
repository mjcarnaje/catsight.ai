// chatReducer.ts
export type Role = "user" | "assistant" | "tool";
export interface Message {
  id: string;
  role: Role;
  content: string;
  timestamp: string;
  sources?: {
    id: string | number;
    title: string;
    description: string;
    file_name: string;
    blurhash: string;
    preview_image: string;
    file_type: string;
    created_at: string;
    updated_at: string;
    contents: {
      snippet: string;
      score: number;
      chunk_index: number;
    }[];
  }[];
}

export type Action =
  | { type: "ADD_USER"; payload: Message }
  | { type: "START_ASSISTANT"; payload: Message }
  | { type: "APPEND_ASSISTANT"; content: string }
  | {
      type: "REPLACE_ASSISTANT";
      payload: { id: string; content: string; sources?: Message["sources"] };
    }
  | { type: "SET_ERROR"; error: string }
  | { type: "SET_CLEAR_MESSAGES"; payload: Message[] }
  | {
      type: "NAVIGATE";
      payload: string | { chatId: string; userMessage?: Message };
    };

export function chatReducer(state: Message[], action: Action): Message[] {
  switch (action.type) {
    case "ADD_USER":
      return [...state, action.payload];

    case "START_ASSISTANT":
      return [...state, action.payload];

    case "APPEND_ASSISTANT":
      return state.map((msg, idx) =>
        idx === state.length - 1 && msg.role === "assistant"
          ? { ...msg, content: msg.content + action.content }
          : msg
      );

    case "REPLACE_ASSISTANT":
      return state.map((msg) =>
        msg.id === action.payload.id
          ? {
              ...msg,
              content: action.payload.content,
              sources: action.payload.sources || msg.sources,
            }
          : msg
      );

    case "SET_ERROR":
      return [
        ...state,
        {
          id: `err-${Date.now()}`,
          role: "assistant",
          content: `Error: ${action.error}`,
          timestamp: new Date().toISOString(),
        },
      ];

    case "SET_CLEAR_MESSAGES":
      return action.payload;

    // NAVIGATE is handled by the parent component, not in the reducer
    // This is intentional as navigation involves router changes
    case "NAVIGATE":
      return state;

    default:
      return state;
  }
}
