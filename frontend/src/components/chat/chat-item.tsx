import { Link, useNavigate } from "react-router-dom";
import { Trash2 } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { chatsApi } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
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

interface ChatItemProps {
  chat: any;
  currentChatId?: string;
}

export function ChatItem({ chat, currentChatId }: ChatItemProps) {
  const navigate = useNavigate();
  const { toast } = useToast();

  const deleteChatMutation = useMutation({
    mutationFn: (chatId: number) => chatsApi.delete(chatId),
    onSuccess: (_, chatId) => {
      toast({
        title: "Chat deleted",
        description: "The chat has been deleted successfully",
      });
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

  const getChatTitle = (chat: any) => {
    return chat.title || `Chat ${chat.id}`;
  };

  return (
    <div
      className={`flex items-center justify-between px-2 py-2 rounded ${String(chat.id) === currentChatId
          ? "bg-gray-100 text-gray-900"
          : "hover:bg-gray-100 text-gray-700"
        }`}
    >
      <Link to={`/chat/${chat.id}`} className="flex-1 block text-sm truncate">
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
              Are you sure you want to delete this chat? This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteChatMutation.mutate(Number(chat.id))}
              disabled={deleteChatMutation.isPending}
            >
              {deleteChatMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
} 