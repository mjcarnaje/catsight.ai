import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { Chat } from "@/types";
import { chatsApi } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import { useUser } from "@/lib/auth";

interface ChatContextType {
  recentChats: Chat[];
  isLoading: boolean;
  error: string | null;
  updateChatTitle: (chatId: string, title: string) => void;
  fetchRecentChats: () => void;
  addNewChat: (chat: Chat) => void;
  removeChat: (chatId: number | string) => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: ReactNode }) {
  const { data: user } = useUser();
  const { toast } = useToast();
  const [recentChats, setRecentChats] = useState<Chat[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRecentChats = () => {
    setIsLoading(true);
    setError(null);

    chatsApi
      .getRecent(50)
      .then((response) => {
        setRecentChats(response.data);
        setIsLoading(false);
      })
      .catch((err) => {
        console.error("Failed to fetch recent chats:", err);

        // Log detailed error information
        if (err.response) {
          setError(
            `Server error: ${err.response.status} ${err.response.data?.message ||
            err.response.statusText ||
            "Unknown error"
            }`
          );
        } else if (err.request) {
          console.error("No response received:", err.request);
          setError("Network error: No response from server");
        } else {
          console.error("Request error:", err.message);
          setError(`Request error: ${err.message}`);
        }

        toast({
          title: "Error",
          description: "Failed to load your recent chats.",
          variant: "destructive",
        });
        setIsLoading(false);
      });
  };

  const updateChatTitle = (chatId: string, title: string) => {
    setRecentChats((prevChats) =>
      prevChats.map((chat) =>
        String(chat.id) === chatId ? { ...chat, title } : chat
      )
    );
  };

  // Add a new chat to the recent chats list
  const addNewChat = (chat: Chat) => {
    // Check if the chat already exists in the list
    const exists = recentChats.some((c) => String(c.id) === String(chat.id));

    if (!exists) {
      setRecentChats((prevChats) => [chat, ...prevChats]);
    }
  };

  // Remove a chat from the recent chats list
  const removeChat = (chatId: number | string) => {
    setRecentChats((prevChats) =>
      prevChats.filter((chat) => String(chat.id) !== String(chatId))
    );
  };

  // Fetch chats on initial load
  useEffect(() => {
    if (user) {
      fetchRecentChats();
    }
  }, [user]);

  return (
    <ChatContext.Provider
      value={{
        recentChats,
        isLoading,
        error,
        updateChatTitle,
        fetchRecentChats,
        addNewChat,
        removeChat,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export const useChatContext = () => {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error("useChatContext must be used within a ChatProvider");
  }
  return context;
}; 