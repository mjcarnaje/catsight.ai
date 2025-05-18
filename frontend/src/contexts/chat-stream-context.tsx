import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useEffect,
  ReactNode,
  useReducer,
} from "react";
import { useChatContext } from "@/contexts/chat-context";
import { generateId } from "@/lib/utils";
import { Message } from "@/types/message";
import { useNavigate } from "react-router-dom";

type ChatAction =
  | { type: "ADD_MESSAGE"; payload: Message }
  | { type: "SET_MESSAGES"; payload: Message[] }
  | { type: "SET_ERROR"; error: string };

const chatReducer = (state: Message[], action: ChatAction): Message[] => {
  console.log(`=== CALLING ${action.type} ===`);
  // @ts-expect-error - This is a workaround to avoid TypeScript errors
  console.log(`=== PAYLOAD ===`, action?.payload || "NO PAYLOAD");

  switch (action.type) {
    case "ADD_MESSAGE":
      return [...state, action.payload];
    case "SET_MESSAGES":
      return action.payload;
    case "SET_ERROR":
      console.error("Error:", action.error);
      return state;
    default:
      return state;
  }
};

interface ChatStreamContextType {
  isStreaming: boolean;
  newChatId: string | null;
  setNewChatId: (chatId: string | null) => void;
  sendMessage: (
    userText: string,
    chatId: string | undefined,
    modelId: string | null,
    fileIds?: number[]
  ) => void;
  messages: Message[];
  dispatch: React.Dispatch<ChatAction>;
}

const ChatStreamContext = createContext<ChatStreamContextType | undefined>(
  undefined
);

export function ChatStreamProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const abortRef = useRef<AbortController | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { updateChatTitle, addNewChat } = useChatContext();
  const [messages, dispatch] = useReducer(chatReducer, [] as Message[]);
  const [newChatId, setNewChatId] = useState<string | null>(null);

  const sendMessage = useCallback(
    (userText: string, chatId: string | undefined, modelId: string | null, fileIds?: number[]) => {
      if (!modelId) {
        setError("Please select a model first");
        return;
      }

      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;

      setIsStreaming(true);

      const userMessage: Message = {
        id: generateId(),
        role: "user",
        content: userText,
        timestamp: new Date().toISOString(),
        message_type: "message",
        tool_call: undefined,
        tool_result: undefined,
      };

      if (!chatId) {
        dispatch({ type: "ADD_MESSAGE", payload: userMessage });
      }

      fetch(`/api/documents/chat/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("access_token")}`,
        },
        body: JSON.stringify({
          query: userText,
          model_id: modelId,
          chat_id: chatId,
          file_ids: fileIds,
        }),
        signal: ctrl.signal,
      })
        .then((res) => {
          if (!res.ok) throw new Error(res.statusText);
          const reader = res.body!.getReader();
          const decoder = new TextDecoder();
          let buffer = "";

          let newChatId: string | null = null;

          function readChunk(): Promise<void> {
            return reader.read().then(({ done, value }) => {
              if (done) {
                setIsStreaming(false);
                return;
              }

              buffer += decoder.decode(value, { stream: true });

              const parts = buffer.split("\n\n");
              buffer = parts.pop()!;

              for (const part of parts) {
                const eventMatch = part.match(/^event:\s*(\w+)/m);
                const dataMatch = part.match(/^data:\s*(.*)$/m);

                if (!eventMatch || !dataMatch) continue;

                const eventType = eventMatch[1];
                const dataLine = dataMatch[1];

                let data: any = {};
                try {
                  data = JSON.parse(dataLine);
                } catch (e) {
                  console.error(
                    `Failed to parse ${eventType} data:`,
                    dataLine,
                    e
                  );
                  continue;
                }

                if (eventType === "start") {
                  const startData =
                    typeof dataLine === "string" ? JSON.parse(dataLine) : data;

                  const { chat_id } = startData;

                  if (!chatId) {
                    addNewChat({
                      id: Number(chat_id),
                      title: "New Chat",
                      created_at: new Date().toISOString(),
                      updated_at: new Date().toISOString(),
                    });

                    navigate(`/chat/${chat_id}`, { replace: true });
                    setNewChatId(chat_id);
                    newChatId = chat_id;
                    continue;
                  }
                } else if (eventType === "title" && newChatId) {
                  try {
                    const titleData = JSON.parse(dataLine);
                    if (titleData.title) {
                      updateChatTitle(newChatId, titleData.title);
                    }
                  } catch (e) {
                    console.error("Error parsing title event data:", e);
                  }
                } else if (eventType === "message") {
                  const messageData = JSON.parse(dataLine);
                  dispatch({ type: "ADD_MESSAGE", payload: messageData });
                } else if (eventType === "error") {
                  setError(data.error || "Unknown error");
                }
              }
              return readChunk();
            });
          }
          return readChunk();
        })
        .catch((err) => {
          if (err.name !== "AbortError") {
            setError(err.message);
            setIsStreaming(false);
          }
        });
    },
    [updateChatTitle, addNewChat, navigate]
  );

  useEffect(
    () => () => {
      abortRef.current?.abort();
    },
    []
  );

  return (
    <ChatStreamContext.Provider
      value={{
        isStreaming,
        newChatId,
        setNewChatId,
        sendMessage,
        messages,
        dispatch,
      }}
    >
      {children}
    </ChatStreamContext.Provider>
  );
}

export function useChatStream() {
  const context = useContext(ChatStreamContext);
  if (context === undefined) {
    throw new Error("useChatStream must be used within a ChatStreamProvider");
  }
  return context;
}
