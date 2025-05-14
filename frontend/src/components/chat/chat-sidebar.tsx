import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useChatContext } from "@/contexts/ChatContext";
import { groupChatsByDate } from "@/lib/chat-utils";
import { ChevronDown, RefreshCw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ChatGroup } from "./chat-group";

interface SidebarProps {
  currentChatId?: string;
}

export function ChatSidebar({ currentChatId }: SidebarProps) {
  const navigate = useNavigate();
  const {
    recentChats,
    isLoading,
    error,
    fetchRecentChats,
    hasMore,
    loadMoreChats,
  } = useChatContext();

  const handleNewChat = () => {
    navigate("/chat");
  };

  const groupedChats = groupChatsByDate(recentChats.results);

  return (
    <div className="flex flex-col w-64 h-full border-r border-gray-200">
      <div className="p-4 border-b border-gray-200">
        <Button onClick={handleNewChat} className="w-full">
          New Chat
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading && !recentChats.results.length ? (
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
        ) : recentChats.results.length > 0 ? (
          <>
            <div className="space-y-6">
              <ChatGroup
                title="Today"
                chats={groupedChats.today}
                currentChatId={currentChatId}
              />
              <ChatGroup
                title="Last 7 Days"
                chats={groupedChats.last7Days}
                currentChatId={currentChatId}
              />
              <ChatGroup
                title="Last 30 Days"
                chats={groupedChats.last30Days}
                currentChatId={currentChatId}
              />
              <ChatGroup
                title="Older"
                chats={groupedChats.older}
                currentChatId={currentChatId}
              />
            </div>
            {hasMore && (
              <div className="px-4 py-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-xs text-gray-500 hover:text-gray-900"
                  onClick={loadMoreChats}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <div className="flex items-center gap-2">
                      <RefreshCw className="w-3 h-3 animate-spin" />
                      Loading more chats...
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <ChevronDown className="w-3 h-3" />
                      Load More Chats
                    </div>
                  )}
                </Button>
              </div>
            )}
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
