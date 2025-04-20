import { documentsApi } from "@/lib/api";
import { DocumentStatus, getStatusInfo, getDocumentStatusFromHistory } from "@/lib/document-status";
import { Document, StatusHistory } from "@/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Clock, FileText, Loader2, Trash, User } from "lucide-react";
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
import { Progress } from "./ui/progress";
import { useToast } from "./ui/use-toast";
import { formatDistanceToNow } from "date-fns";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";

interface DocumentCardProps {
  doc: Document;
}

export function DocumentCard({ doc }: DocumentCardProps) {
  const { toast } = useToast();
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

  return (
    <Card key={doc.id} className="transition-shadow hover:shadow-md">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-lg">{doc.title}</CardTitle>
            {doc.uploaded_by && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Avatar className="w-6 h-6">
                      <AvatarImage
                        src={doc.uploaded_by.avatar || ''}
                        alt={doc.uploaded_by.username || doc.uploaded_by.email}
                      />
                      <AvatarFallback>
                        {getInitials(doc.uploaded_by.first_name && doc.uploaded_by.last_name
                          ? `${doc.uploaded_by.first_name} ${doc.uploaded_by.last_name}`
                          : doc.uploaded_by.username)}
                      </AvatarFallback>
                    </Avatar>
                  </TooltipTrigger>
                  <TooltipContent>
                    Uploaded by {doc.uploaded_by.username || doc.uploaded_by.email}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="default">{statusInfo.label}</Badge>
            {doc.status_history && doc.status_history.length > 0 && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="icon" className="ml-2 h-7 w-7">
                    <Clock className="w-4 h-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80">
                  <div className="space-y-2">
                    <h4 className="font-medium">Status History</h4>
                    <div className="space-y-1">
                      {doc.status_history
                        .filter(s => s.changed_at !== null)
                        .sort((a, b) => {
                          return new Date(b.changed_at!).getTime() - new Date(a.changed_at!).getTime();
                        }).map((statusChange: StatusHistory) => (
                          <div key={statusChange.id} className="flex items-center justify-between text-sm">
                            <span>{getStatusInfo(statusChange.status).label}</span>
                            <span className="text-muted-foreground">
                              {statusChange.changed_at && formatDistanceToNow(new Date(statusChange.changed_at), { addSuffix: true })}
                            </span>
                          </div>
                        ))}
                    </div>
                    <div className="pt-2 mt-2 border-t">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Progress</span>
                        <span className="text-sm">{statusInfo.progress}%</span>
                      </div>
                      <Progress value={statusInfo.progress} className="h-2 mt-1" />
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            )}
          </div>
        </div>
        <CardDescription>
          {new Date(doc.created_at).toLocaleDateString()}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="mb-2 text-sm">
          {doc.description || "No description available"}
        </p>
        {doc.status !== DocumentStatus.COMPLETED && !doc.is_failed && (
          <div className="space-y-2">
            <Progress value={statusInfo.progress} className="h-2" />
            <div className="text-xs text-muted-foreground">
              {completedStatuses.length > 0 && (
                <div className="mt-2 space-y-1">
                  {completedStatuses.map((statusChange: StatusHistory) => (
                    <div key={statusChange.id} className="flex items-center justify-between">
                      <span>{getStatusInfo(statusChange.status).label}</span>
                      <span>{statusChange.changed_at && formatDistanceToNow(new Date(statusChange.changed_at), { addSuffix: true })}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
        <div className="flex justify-between mt-2 text-xs text-muted-foreground">
          <span>{doc.no_of_chunks || 0} chunks</span>
        </div>
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button
          variant="outline"
          size="sm"
          onClick={() => (window.location.href = `/document/${doc.id}`)}
        >
          <FileText className="w-4 h-4 mr-2" />
          View
        </Button>
        <div className="flex space-x-2">
          <Button
            variant="outline"
            size="sm"
            className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
            onClick={() => handleDeleteMutation.mutate()}
          >
            {handleDeleteMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Trash className="w-4 h-4" />
            )}
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}
