import { documentsApi, getDocumentPreviewUrl } from "@/lib/api";
import { DocumentStatus, calculateDocumentStatusFromHistory, getDocumentStatusDisplay } from "@/lib/document-status-config";
import { Document } from "@/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronRight, Eye, FileText, Image as ImageIcon, Loader2, MoreHorizontal, RefreshCw, RotateCw, Trash, User } from "lucide-react";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { useToast } from "./ui/use-toast";
import { formatDistanceToNow } from "date-fns";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui/tooltip";
import { Progress } from "./ui/progress";
import { useNavigate } from "react-router-dom";
import { StatusHistoryPopover } from "./status-history-popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { Blurhash } from "react-blurhash";
import { useState } from "react";
import { MARKDOWN_CONVERTERS } from "../lib/markdown-converter";

interface DocumentTableProps {
  documents: Document[];
}

export function DocumentTable({ documents }: DocumentTableProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [loadedPreviews, setLoadedPreviews] = useState<Record<number, boolean>>({});

  const handleDeleteMutation = useMutation({
    mutationFn: (docId: number) => documentsApi.delete(docId.toString()),
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

  const regeneratePreviewMutation = useMutation({
    mutationFn: (docId: number) => documentsApi.regeneratePreview(docId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      toast({
        title: "Success",
        description: "Preview image regenerated successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to regenerate preview image. Please try again.",
        variant: "destructive",
      });
    },
  });

  const regenerateSummaryMutation = useMutation({
    mutationFn: (docId: number) => documentsApi.regenerateSummary(docId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      toast({
        title: "Success",
        description: "Document summary regeneration started. This might take a moment.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to regenerate document summary. Please try again.",
        variant: "destructive",
      });
    },
  });

  const reextractMutation = useMutation({
    mutationFn: ({ docId, converter }: { docId: number, converter: string }) =>
      documentsApi.reextract(docId, converter),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      toast({
        title: "Success",
        description: "Document re-extraction started. This might take a moment.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to re-extract document. Please try again.",
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

  const handleImageLoad = (docId: number) => {
    setLoadedPreviews(prev => ({
      ...prev,
      [docId]: true
    }));
  };

  return (
    <Table>
      <TableHeader>
        <TableRow className="bg-muted/40 hover:bg-muted/40">
          <TableHead className="w-[50px] font-medium">Preview</TableHead>
          <TableHead className="w-[200px] md:w-[280px] font-medium">Title</TableHead>
          <TableHead className="hidden font-medium sm:table-cell">Status</TableHead>
          <TableHead className="hidden font-medium md:table-cell">Uploader</TableHead>
          <TableHead className="hidden font-medium md:table-cell">Created</TableHead>
          <TableHead className="hidden font-medium sm:table-cell">Chunks</TableHead>
          <TableHead className="font-medium text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {documents.map((doc) => {
          const hasStatusHistory = doc.status_history && doc.status_history.length > 0;
          const statusInfo = hasStatusHistory
            ? calculateDocumentStatusFromHistory(doc.status_history)
            : { ...getDocumentStatusDisplay(doc.status), progress: 0, currentStatus: doc.status };

          const hasPreview = doc.preview_image && doc.blurhash;
          const previewImageUrl = getDocumentPreviewUrl(doc.preview_image);
          const isImageLoaded = loadedPreviews[doc.id] || false;

          return (
            <TableRow
              key={doc.id}
              className="transition-colors cursor-pointer group"
              onClick={() => navigate(`/documents/${doc.id}`)}
            >
              <TableCell className="w-[50px]">
                <div className="relative w-10 overflow-hidden border rounded-sm h-14 border-border">
                  {hasPreview ? (
                    <>
                      {!isImageLoaded && doc.blurhash && (
                        <div className="absolute inset-0">
                          <Blurhash
                            hash={doc.blurhash}
                            width="100%"
                            height="100%"
                            resolutionX={32}
                            resolutionY={32}
                            punch={1}
                          />
                        </div>
                      )}
                      <img
                        src={previewImageUrl}
                        alt={doc.title}
                        className={`w-full h-full object-cover transition-opacity duration-300 ${isImageLoaded ? 'opacity-100' : 'opacity-0'}`}
                        onLoad={() => handleImageLoad(doc.id)}
                      />
                    </>
                  ) : (
                    <div className="flex items-center justify-center w-full h-full bg-muted/30 text-muted-foreground">
                      <ImageIcon className="w-4 h-4" />
                    </div>
                  )}
                </div>
              </TableCell>
              <TableCell className="font-medium">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-md bg-primary/5 text-primary">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="transition-colors group-hover:text-primary line-clamp-1">{doc.title}</span>
                    <div className="flex items-center mt-1 sm:hidden">
                      <Badge
                        variant="outline"
                        className={cn(`rounded-full px-2 py-0.5 font-medium text-xs transition-colors whitespace-nowrap`, statusInfo.color.bg, statusInfo.color.border, statusInfo.color.text)}
                      >
                        {statusInfo.showLoading ? (
                          <>
                            <Loader2 className="w-3.5 mr-1 h-3.5 animate-spin" />
                            {statusInfo.label}
                          </>
                        ) : (
                          <>
                            {statusInfo.label}
                          </>
                        )}
                      </Badge>
                    </div>
                  </div>
                </div>
              </TableCell>
              <TableCell className="hidden sm:table-cell">
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className={cn(`rounded-full px-2 py-0.5 font-medium text-xs transition-colors whitespace-nowrap`, statusInfo.color.bg, statusInfo.color.border, statusInfo.color.text)}
                  >
                    {statusInfo.showLoading ? (
                      <>
                        <Loader2 className="w-3.5 mr-1 h-3.5 animate-spin" />
                        {statusInfo.label}
                      </>
                    ) : (
                      <>
                        {statusInfo.label}
                      </>
                    )}
                  </Badge>
                  {doc.status_history && doc.status_history.length > 0 && (
                    <StatusHistoryPopover
                      statusHistory={doc.status_history}
                      progress={statusInfo.progress}
                    />
                  )}
                </div>
              </TableCell>
              <TableCell className="hidden md:table-cell">
                {doc.uploaded_by ? (
                  <div className="flex items-center gap-2">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger>
                          <Avatar className="w-6 h-6 border-[1px] border-primary/10">
                            <AvatarImage
                              src={doc.uploaded_by.avatar || ''}
                              alt={doc.uploaded_by.username || doc.uploaded_by.email}
                            />
                            <AvatarFallback className="text-xs bg-primary/5 text-primary">
                              {getInitials(doc.uploaded_by.first_name && doc.uploaded_by.last_name
                                ? `${doc.uploaded_by.first_name} ${doc.uploaded_by.last_name}`
                                : doc.uploaded_by.username)}
                            </AvatarFallback>
                          </Avatar>
                        </TooltipTrigger>
                        <TooltipContent>
                          {doc.uploaded_by.username || doc.uploaded_by.email}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <span className="text-sm truncate max-w-[120px]">
                      {doc.uploaded_by.username || doc.uploaded_by.email.split('@')[0]}
                    </span>
                  </div>
                ) : (
                  <span className="text-muted-foreground">-</span>
                )}
              </TableCell>
              <TableCell className="hidden md:table-cell">
                <span className="text-sm text-muted-foreground">
                  {formatDistanceToNow(new Date(doc.created_at), { addSuffix: true })}
                </span>
              </TableCell>
              <TableCell className="hidden sm:table-cell">
                <div className="px-2.5 py-1 rounded-full bg-muted w-fit text-xs font-medium">
                  {doc.no_of_chunks || 0}
                </div>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end space-x-2" onClick={(e) => e.stopPropagation()}>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-8 h-8 rounded-full text-muted-foreground hover:text-primary"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/documents/${doc.id}`);
                    }}
                  >
                    <Eye className="w-4 h-4" />
                  </Button>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="w-8 h-8 rounded-full text-muted-foreground"
                      >
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        className="flex items-center gap-2"
                        onClick={(e) => {
                          e.stopPropagation();
                          regenerateSummaryMutation.mutate(doc.id);
                        }}
                        disabled={regenerateSummaryMutation.isPending && regenerateSummaryMutation.variables === doc.id}
                      >
                        {regenerateSummaryMutation.isPending && regenerateSummaryMutation.variables === doc.id ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <RefreshCw className="w-4 h-4 mr-2" />
                        )}
                        Regenerate Summary
                      </DropdownMenuItem>
                      {!(doc.preview_image && doc.blurhash) && (
                        <>
                          <DropdownMenuItem
                            className="flex items-center gap-2"
                            onClick={(e) => {
                              e.stopPropagation();
                              regeneratePreviewMutation.mutate(doc.id);
                            }}
                            disabled={regeneratePreviewMutation.isPending && regeneratePreviewMutation.variables === doc.id}
                          >
                            {regeneratePreviewMutation.isPending && regeneratePreviewMutation.variables === doc.id ? (
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            ) : (
                              <RotateCw className="w-4 h-4 mr-2" />
                            )}
                            Generate Preview
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                        </>
                      )}
                      <DropdownMenuItem disabled className="text-xs text-muted-foreground">
                        Re-extract with:
                      </DropdownMenuItem>
                      {Object.entries(MARKDOWN_CONVERTERS).map(([key, converter]) => (
                        <DropdownMenuItem
                          key={key}
                          className="flex items-center gap-2"
                          onClick={(e) => {
                            e.stopPropagation();
                            reextractMutation.mutate({ docId: doc.id, converter: key });
                          }}
                          disabled={reextractMutation.isPending}
                        >
                          {reextractMutation.isPending && reextractMutation.variables?.docId === doc.id ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          ) : (
                            <converter.icon className="w-4 h-4 mr-2" />
                          )}
                          {converter.label}
                        </DropdownMenuItem>
                      ))}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteMutation.mutate(doc.id);
                        }}
                      >
                        {handleDeleteMutation.isPending && handleDeleteMutation.variables === doc.id ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Trash className="w-4 h-4 mr-2" />
                        )}
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </TableCell>
            </TableRow>
          );
        })}

        {documents.length === 0 && (
          <TableRow>
            <TableCell colSpan={7} className="h-24 text-center">
              <div className="flex flex-col items-center justify-center text-muted-foreground">
                <FileText className="w-8 h-8 mb-2" />
                <p>No documents found</p>
              </div>
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
} 