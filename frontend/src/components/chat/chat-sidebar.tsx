import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { MessageSquare, RefreshCw, Trash2 } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useChatContext } from "@/contexts/ChatContext";
import { useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { chatsApi } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface SidebarProps {
  currentChatId?: string;
}

export function ChatSidebar({ currentChatId }: SidebarProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { recentChats, isLoading, error, fetchRecentChats, removeChat } =
    useChatContext();

  const handleNewChat = () => {
    navigate("/chat");
  };

  // Delete chat mutation
  const deleteChatMutation = useMutation({
    mutationFn: (chatId: number) => chatsApi.delete(chatId),
    onSuccess: (_, chatId) => {
      toast({
        title: "Chat deleted",
        description: "The chat has been deleted successfully",
      });
      // Remove the chat from the local state
      removeChat(chatId);
      // If the deleted chat is the current one, navigate to new chat
      if (currentChatId && parseInt(currentChatId) === chatId) {
        navigate("/chat");
      }
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to delete chat. Please try again.",
        variant: "destructive",
      });
      console.error("Error deleting chat:", error);
    },
  });

  // Generate chat title from the first message or use a timestamp
  const getChatTitle = (chat) => {
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
                <div
                  key={chat.id}
                  className={`flex items-center justify-between px-2 py-2 rounded ${String(chat.id) === currentChatId
                    ? "bg-gray-100 text-gray-900"
                    : "hover:bg-gray-100 text-gray-700"
                    }`}
                >
                  <Link
                    to={`/chat/${chat.id}`}
                    className="flex-1 block text-sm truncate"
                  >
                    <div className="flex items-center gap-2">
                      <span>{getChatTitle(chat)}</span>
                    </div>
                  </Link>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="w-6 h-6 opacity-0 hover:opacity-100 hover:bg-gray-200 group-hover:opacity-100"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Trash2 className="w-4 h-4 text-gray-500" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Chat</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to delete this chat? This action
                          cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() =>
                            deleteChatMutation.mutate(Number(chat.id))
                          }
                          disabled={deleteChatMutation.isPending}
                        >
                          {deleteChatMutation.isPending
                            ? "Deleting..."
                            : "Delete"}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
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
