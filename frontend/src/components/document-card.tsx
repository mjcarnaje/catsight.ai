import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import { Document } from "@/lib/api";
import { DocumentStatus, getDocumentStatus } from "@/lib/document-status";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import {
  AlertTriangleIcon,
  CheckIcon,
  FolderIcon,
  LoaderCircleIcon,
  MessageCircleIcon,
  MoreHorizontal,
  RefreshCcwIcon,
  TrashIcon,
} from "lucide-react";
import { Link } from "react-router-dom";

interface DocumentCardProps {
  document: Document;
  onDelete: (id: number) => void;
  onRetry?: (id: number) => Promise<void>;
}

export function DocumentCard({
  document,
  onDelete,
  onRetry,
}: DocumentCardProps) {
  const { id, title, status, is_failed, created_at } = document;
  const { label, color, progress } = getDocumentStatus(status);

  const isFailed = is_failed;
  const isCompleted = status === DocumentStatus.COMPLETED;
  const isLoading = progress > 0 && progress < 100;

  const handleChat = (e: React.MouseEvent) => {
    e.preventDefault();
    window.open(`/chat/${id}`, "_blank");
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.preventDefault();
    onDelete(id);
  };

  const handleRetry = (e: React.MouseEvent) => {
    e.preventDefault();
    onRetry?.(id);
  };

  return (
    <Link
      to={`/documents/${id}`}
      className={cn(
        "group p-6 border border-white/10 flex flex-col gap-3 rounded-3xl",
        "hover:shadow-lg hover:scale-[1.02] cursor-pointer transition-all",
        "duration-300 backdrop-blur-xl bg-white/10 relative"
      )}
    >
      <div className="flex items-center justify-between">
        <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center group-hover:bg-blue-500/20 transition-colors">
          <FolderIcon className="h-6 w-6 text-blue-400" />
        </div>

        <div className="absolute top-4 right-4">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className={cn(
                  "h-8 w-8 p-0 group-hover:bg-blue-500/20 transition-all",
                  "opacity-0 group-hover:opacity-100 text-gray-400 hover:text-white"
                )}
              >
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="bg-gray-900 border-white/10"
            >
              <DropdownMenuItem
                onClick={handleChat}
                className={cn(
                  "text-blue-400 focus:text-blue-300 hover:bg-blue-500/50 cursor-pointer"
                )}
              >
                <MessageCircleIcon className="h-4 w-4 mr-2" />
                Chat
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={handleDelete}
                className={cn(
                  "text-red-400 focus:text-red-300 hover:bg-blue-500/50 cursor-pointer"
                )}
              >
                <TrashIcon className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
              {isFailed && onRetry && (
                <DropdownMenuItem
                  onClick={handleRetry}
                  className={cn(
                    "text-yellow-400 focus:text-yellow-300 hover:bg-blue-500/50 cursor-pointer"
                  )}
                >
                  <RefreshCcwIcon className="h-4 w-4 mr-2" />
                  Retry Processing
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="space-y-1.5">
        <p
          className={cn(
            "text-xl font-semibold text-white group-hover:text-blue-400 transition-colors line-clamp-2"
          )}
        >
          {title}
        </p>
        <p className="text-sm font-medium text-gray-400">
          {format(created_at, "MMM d, yyyy")}
        </p>
      </div>

      <div className="space-y-2 mt-auto">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isLoading && !isFailed && (
              <div className="animate-spin">
                <LoaderCircleIcon className="h-4 w-4 text-blue-400" />
              </div>
            )}
            {isFailed && (
              <AlertTriangleIcon className="h-4 w-4 text-yellow-400" />
            )}
            {isCompleted && <CheckIcon className="h-4 w-4 text-green-400" />}
            <span
              className={cn(
                "text-sm font-medium",
                isFailed ? "text-yellow-400" : "text-blue-400"
              )}
            >
              {label}
            </span>
          </div>
          {isLoading && (
            <span className="text-sm font-semibold text-gray-400">
              {progress}%
            </span>
          )}
        </div>
        {isLoading && (
          <Progress
            value={progress}
            className={cn("h-2", isFailed ? "text-red-400" : "text-blue-400")}
          />
        )}
      </div>
    </Link>
  );
}
