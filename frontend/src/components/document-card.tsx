import { documentsApi } from "@/lib/api";
import { getDocumentStatusFromHistory, getStatusInfo } from "@/lib/document-status";
import { Document } from "@/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Calendar, ChevronRight, FileText, Layers, Loader2, Tag, Trash } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { MARKDOWN_CONVERTERS } from "../lib/markdown-converter";
import { StatusHistoryPopover } from "./status-history-popover";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "./ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui/tooltip";
import { useToast } from "./ui/use-toast";
interface DocumentCardProps {
  doc: Document;
}

export function DocumentCard({ doc }: DocumentCardProps) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const hasStatusHistory = doc.status_history && doc.status_history.length > 0;

  // Use status history if available, otherwise use the current status
  const statusInfo = hasStatusHistory
    ? getDocumentStatusFromHistory(doc.status_history)
    : { ...getStatusInfo(doc.status), progress: 0, currentStatus: doc.status };

  const queryClient = useQueryClient();

  const handleDeleteMutation = useMutation({
    mutationFn: () => documentsApi.delete(doc.id.toString()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      toast({
        title: "Success",
        description: "Document deleted successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete document. Please try again.",
        variant: "destructive",
      });
    },
  });

  const getInitials = (name?: string) => {
    if (!name) return "U";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .substring(0, 2);
  };

  // Get the status changes with timestamps (completed statuses)
  const completedStatuses = hasStatusHistory
    ? doc.status_history!
      .filter(s => s.changed_at !== null)
      .sort((a, b) => {
        return new Date(b.changed_at!).getTime() - new Date(a.changed_at!).getTime();
      })
    : [];

  const ConverterIcon = MARKDOWN_CONVERTERS[doc.markdown_converter].icon

  return (
    <Card key={doc.id} className="transition-all hover:shadow-md group">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-lg font-medium">{doc.title}</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant="default"
              className={`${statusInfo.label === 'Processing' ? 'bg-amber-500' :
                statusInfo.label === 'Completed' ? 'bg-green-500' :
                  statusInfo.label === 'Failed' ? 'bg-red-500' : ''}`}
            >
              {statusInfo.label}
            </Badge>
            {hasStatusHistory && (
              <StatusHistoryPopover
                statusHistory={doc.status_history}
                progress={statusInfo.progress}
              />
            )}
          </div>
        </div>
        <div className="flex items-center justify-between mt-1">
          <CardDescription className="flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5" />
            {new Date(doc.created_at).toLocaleDateString()}
          </CardDescription>
          {doc.uploaded_by && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span>By</span>
                    <Avatar className="w-5 h-5">
                      <AvatarImage
                        src={doc.uploaded_by.avatar || ''}
                        alt={doc.uploaded_by.username || doc.uploaded_by.email}
                      />
                      <AvatarFallback className="text-[10px]">
                        {getInitials(doc.uploaded_by.first_name && doc.uploaded_by.last_name
                          ? `${doc.uploaded_by.first_name} ${doc.uploaded_by.last_name}`
                          : doc.uploaded_by.username)}
                      </AvatarFallback>
                    </Avatar>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  Uploaded by {doc.uploaded_by.username || doc.uploaded_by.email}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </CardHeader>
      <CardContent className="pb-3">
        {doc.description ? (
          <p className="mb-3 text-sm text-muted-foreground">{doc.description}</p>
        ) : (
          <p className="mb-3 text-sm italic text-muted-foreground">No description available</p>
        )}

        <div className="grid grid-cols-2 text-xs gap-x-4 gap-y-2">
          <div className="flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-muted-foreground" />
            <span>{doc.no_of_chunks || 0} chunks</span>
          </div>

          <div className="flex items-center gap-1.5">
            {ConverterIcon && <ConverterIcon className="w-3.5 h-3.5 text-muted-foreground" />}
            <span className="truncate">{MARKDOWN_CONVERTERS[doc.markdown_converter].label}</span>
          </div>

          <div className="flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="truncate" title={doc.file_name}>{doc.file_name}</span>
          </div>

          <div className="flex items-center gap-1.5">
            <Tag className="w-3.5 h-3.5 text-muted-foreground" />
            <span>{doc.file_type}</span>
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex justify-between pt-2 border-t">
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 group-hover:text-primary group-hover:font-medium transition-all"
          onClick={() => navigate(`/documents/${doc.id}`)}
        >
          View details
          <ChevronRight className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
          onClick={() => handleDeleteMutation.mutate()}
          disabled={handleDeleteMutation.isPending}
        >
          {handleDeleteMutation.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Trash className="w-4 h-4" />
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}
