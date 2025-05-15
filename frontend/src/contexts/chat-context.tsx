import { useToast } from "@/components/ui/use-toast";
import { chatsApi } from "@/lib/api";
import { Chat, PaginatedResponse } from "@/types";
import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";
import { useSession } from "./session-context";

interface ChatContextType {
  recentChats: PaginatedResponse<Chat>;
  isLoading: boolean;
  error: string | null;
  hasMore: boolean;
  currentPage: number;
  totalPages: number;
  totalCount: number;
  loadMoreChats: () => Promise<void>;
  updateChatTitle: (chatId: string, title: string) => void;
  fetchRecentChats: () => void;
  addNewChat: (chat: Chat) => void;
  removeChat: (chatId: number | string) => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: ReactNode }) {
  const { user } = useSession();
  const { toast } = useToast();
  const [recentChats, setRecentChats] = useState<PaginatedResponse<Chat>>({
    results: [],
    total_pages: 1,
    total_count: 0,
    has_next: false,
    has_previous: false,
    current_page: 1,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const PAGE_SIZE = 20;

  const fetchRecentChats = () => {
    setIsLoading(true);
    setError(null);
    setCurrentPage(1);

    chatsApi
      .getRecent(PAGE_SIZE, 1)
      .then((response) => {
        const { results, total_pages, total_count, has_next } = response.data;
        setRecentChats({
          results,
          total_pages,
          total_count,
          has_next,
          has_previous: false,
          current_page: 1,
        });
        setTotalPages(total_pages);
        setTotalCount(total_count);
        setHasMore(has_next);
        setIsLoading(false);
      })
      .catch((err) => {
        console.error("Failed to fetch chats:", err);

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
          description: "Failed to load your chats.",
          variant: "destructive",
        });
        setIsLoading(false);
      });
  };

  const loadMoreChats = async () => {
    if (!hasMore || isLoading) return;

    setIsLoading(true);
    const nextPage = currentPage + 1;

    try {
      const response = await chatsApi.getRecent(PAGE_SIZE, nextPage);
      const { results, has_next } = response.data;

      setRecentChats((prevChats) => ({
        ...prevChats,
        results: [...prevChats.results, ...results],
        has_next: has_next,
        current_page: nextPage,
      }));
      setHasMore(has_next);
      setCurrentPage(nextPage);
    } catch (err) {
      console.error("Failed to load more chats:", err);
      toast({
        title: "Error",
        description: "Failed to load more chats.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const updateChatTitle = (chatId: string, title: string) => {
    setRecentChats((prevChats) => ({
      ...prevChats,
      results: prevChats.results.map((chat) =>
        String(chat.id) === chatId ? { ...chat, title } : chat
      ),
    }));
  };

  const addNewChat = (chat: Chat) => {
    const exists = recentChats.results.some(
      (c) => String(c.id) === String(chat.id)
    );

    if (!exists) {
      setRecentChats((prevChats) => ({
        ...prevChats,
        results: [chat, ...prevChats.results],
        total_count: prevChats.total_count + 1,
      }));
    }
  };

  const removeChat = (chatId: number | string) => {
    setRecentChats((prevChats) => ({
      ...prevChats,
      results: prevChats.results.filter(
        (chat) => String(chat.id) !== String(chatId)
      ),
      total_count: prevChats.total_count - 1,
    }));
  };

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
        hasMore,
        currentPage,
        totalPages,
        totalCount,
        loadMoreChats,
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
