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
  CheckIcon,
  FolderIcon,
  LoaderCircleIcon,
  MoreHorizontal,
} from "lucide-react";
import { Link } from "react-router-dom";

interface DocumentCardProps {
  document: Document;
  onDelete: (id: number) => void;
}

export function DocumentCard({ document, onDelete }: DocumentCardProps) {
  const { label, color, progress } = getDocumentStatus(document.status);
  const isFailed = document.is_failed;
  const isCompleted = document.status === DocumentStatus.COMPLETED;
  const isLoading = progress > 0 && progress < 100;
  return (
    <Link
      to={`/documents/${document.id}`}
      className="group p-6 border border-gray-200 flex flex-col gap-3 rounded-3xl hover:shadow-md hover:scale-[1.01] cursor-pointer transition-all duration-300 bg-gradient-radial from-blue-50 to-blue-200 relative"
    >
      <div className="flex items-center justify-between">
        <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center group-hover:bg-blue-100 transition-colors">
          <FolderIcon className="h-6 w-6 text-blue-600" />
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity absolute top-4 right-4"
            >
              <MoreHorizontal className="text-gray-600" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={(e) => {
                e.preventDefault();
                onDelete(document.id);
              }}
              className="text-red-600 focus:text-red-700"
            >
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="space-y-1">
        <p className="text-xl font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
          {document.title}
        </p>
        <p className="text-sm font-medium text-gray-500">
          {format(document.created_at, "MMM d, yyyy")}
        </p>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isLoading ? (
              <div className="animate-spin">
                <LoaderCircleIcon className="h-4 w-4 text-blue-600" />
              </div>
            ) : isCompleted ? (
              <CheckIcon className={cn("h-4 w-4", color.text)} />
            ) : (
              <></>
            )}
            <span
              className={cn(
                "text-sm font-medium",
                isFailed ? "text-red-600" : color.text
              )}
            >
              {label}
            </span>
          </div>
          {isLoading && (
            <span className="text-sm text-gray-500">{progress}%</span>
          )}
        </div>
        {isLoading && (
          <Progress
            value={progress}
            className={cn("h-2", isFailed ? "text-red-600" : color.text)}
          />
        )}
      </div>
    </Link>
  );
}
