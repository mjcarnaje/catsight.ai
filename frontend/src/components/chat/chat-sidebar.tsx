import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/use-toast";
import { chatsApi } from "@/lib/api";
import { Chat } from "@/types";
import { MessageSquare, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

interface SidebarProps {
  currentChatId?: string;
}

export function ChatSidebar({ currentChatId }: SidebarProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [recentChats, setRecentChats] = useState<Chat[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Function to fetch chats that can be called for retry
  const fetchRecentChats = () => {
    setIsLoading(true);
    setError(null);

    chatsApi
      .getRecent(10)
      .then((response) => {
        setRecentChats(response.data);
        setIsLoading(false);
      })
      .catch((err) => {
        console.error("Failed to fetch recent chats:", err);

        // Log detailed error information
        if (err.response) {
          // The request was made and the server responded with a status code

          setError(
            `Server error: ${err.response.status} ${err.response.data?.message ||
            err.response.statusText ||
            "Unknown error"
            }`
          );
        } else if (err.request) {
          // The request was made but no response was received
          console.error("No response received:", err.request);
          setError("Network error: No response from server");
        } else {
          // Something happened in setting up the request that triggered an Error
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

  // Fetch recent chats on component mount and when currentChatId changes
  useEffect(() => {
    fetchRecentChats();
  }, [currentChatId]);

  const handleNewChat = () => {
    navigate("/chat");
  };

  // Generate chat title from the first message or use a timestamp
  const getChatTitle = (chat: Chat) => {
    return chat.title || `Chat ${chat.id}`;
  };

  return (
    <div className="flex flex-col w-64 h-full border-r border-gray-200">
      <div className="p-4 border-b border-gray-200">
        <Button onClick={handleNewChat} className="w-full">
          New Chat
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="px-4 py-2 space-y-2">
            <Skeleton className="w-3/4 h-5" />
            <Skeleton className="w-full h-10" />
            <Skeleton className="w-full h-10" />
            <Skeleton className="w-full h-10" />
          </div>
        ) : error ? (
          <div className="px-4 py-8 text-center">
            <p className="mb-3 text-sm text-red-500">{error}</p>
            <Button
              size="sm"
              variant="outline"
              onClick={fetchRecentChats}
              className="flex items-center gap-1 mx-auto"
            >
              <RefreshCw className="w-3 h-3" />
              Retry
            </Button>
          </div>
        ) : recentChats.length > 0 ? (
          <>
            <div className="px-4 py-2 text-xs text-gray-500">Recent</div>
            <div className="px-2 space-y-1">
              {recentChats.map((chat) => (
                <Link
                  key={chat.id}
                  to={`/chat/${chat.id}`}
                  className={`block px-2 py-2 rounded text-sm truncate ${String(chat.id) === currentChatId
                    ? "bg-gray-100 text-gray-900"
                    : "hover:bg-gray-100 text-gray-700"
                    }`}
                >
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-gray-500" />
                    <span>{getChatTitle(chat)}</span>
                  </div>
                  {chat.model_name && (
                    <div className="pl-6 mt-1 text-xs text-gray-500">
                      {chat.model_name}
                    </div>
                  )}
                </Link>
              ))}
            </div>
          </>
        ) : (
          <div className="px-4 py-8 text-sm text-center text-gray-500">
            No chats found. Start a new conversation!
          </div>
        )}
      </div>
    </div>
  );
}
