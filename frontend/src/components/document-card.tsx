import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { documentsApi, getDocumentPreviewUrl } from "@/lib/api";
import { DOCUMENT_STATUS_CONFIG } from "@/lib/document-status-config";
import { cn } from "@/lib/utils";
import { Document, ModelInfo } from "@/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Book, Calendar, ChevronRight, FileText, Image as ImageIcon, Layers, Loader2, MoreHorizontal, RefreshCw, RotateCw, Tag, Trash } from "lucide-react";
import { useState } from "react";
import { Blurhash } from "react-blurhash";
import { useNavigate } from "react-router-dom";
import { MARKDOWN_CONVERTERS } from "../lib/markdown-converter";
import { ModelSelector } from "./chat/model-selector";
import { StatusHistoryPopover } from "./status-history-popover";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import {
  Card,
  CardDescription
} from "./ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
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
  const [imageLoaded, setImageLoaded] = useState(false);
  const queryClient = useQueryClient();
  const [isModelDialogOpen, setIsModelDialogOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useState<ModelInfo | null>(null);

  const documentYear = doc.year || new Date(doc.created_at).getFullYear();

  const tags = doc.tags || [];

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

  const regeneratePreviewMutation = useMutation({
    mutationFn: () => documentsApi.regeneratePreview(doc.id),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      toast({
        title: "Success",
        description: "Preview image regenerated successfully.",
      });
      // Force reload the current page to see the new preview
      window.location.reload();
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
    mutationFn: (modelId?: string) => documentsApi.regenerateSummary(doc.id, modelId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      toast({
        title: "Summary regeneration started",
        description: "The document summary is being regenerated.",
      });
      setIsModelDialogOpen(false);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to regenerate summary",
        variant: "destructive",
      });
    },
  });

  const reextractMutation = useMutation({
    mutationFn: (converter: string) => documentsApi.reextract(doc.id, converter),
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

  const ConverterIcon = doc.markdown_converter && MARKDOWN_CONVERTERS[doc.markdown_converter]
    ? MARKDOWN_CONVERTERS[doc.markdown_converter].icon
    : undefined;
  const previewImageUrl = getDocumentPreviewUrl(doc.preview_image);

  const handleModelChange = (model: ModelInfo | null) => {
    setSelectedModel(model);
  };

  const handleRegenerateSummary = () => {
    if (selectedModel) {
      regenerateSummaryMutation.mutate(selectedModel.id);
    }
  };

  const statusInfo = DOCUMENT_STATUS_CONFIG[doc.status];

  return (
    <Card
      key={doc.id}
      className="flex flex-col h-full overflow-hidden transition-all duration-300 border rounded-xl bg-gradient-to-b from-white to-muted/5 group hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5"
    >
      {/* Top Section with Image and Basic Info */}
      <div className="flex">
        {/* Preview Image */}
        <div className="relative w-[100px] h-[120px] sm:w-[120px] sm:h-[140px] flex-shrink-0 overflow-hidden">
          {doc.preview_image && doc.blurhash ? (
            <>
              {!imageLoaded && doc.blurhash && (
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
                className={`w-full h-full object-cover transition-all duration-500 ${imageLoaded ? 'opacity-100' : 'opacity-0'} group-hover:scale-105 transition-transform duration-700`}
                onLoad={() => setImageLoaded(true)}
              />
              <div className="absolute inset-0 transition-opacity duration-300 opacity-0 bg-gradient-to-r from-black/40 to-transparent group-hover:opacity-100"></div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center w-full h-full bg-gradient-to-br from-muted/30 to-muted/10">
              <ImageIcon className="w-8 h-8 mb-2 text-muted-foreground/50" />
              <Button
                variant="outline"
                size="sm"
                className="gap-1 text-xs rounded-full"
                onClick={(e) => {
                  e.stopPropagation();
                  regeneratePreviewMutation.mutate();
                }}
                disabled={regeneratePreviewMutation.isPending}
              >
                {regeneratePreviewMutation.isPending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <RotateCw className="w-3.5 h-3.5" />
                )}
                <span className="hidden xs:inline">Generate</span>
              </Button>
            </div>
          )}
        </div>

        {/* Basic Info */}
        <div className="flex-1 p-3 pl-4 overflow-hidden">
          {/* Status Badge and Year - Positioned at top right */}
          <div className="flex justify-end gap-1.5 mb-1.5">
            <Badge
              variant="outline"
              className={cn(
                "rounded-full px-2.5 py-0.5 font-medium text-xs transition-colors whitespace-nowrap",
                statusInfo.bg,
                statusInfo.border,
                statusInfo.text
              )}
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

            {/* Year Badge */}
            <Badge
              variant="secondary"
              className="rounded-full px-2.5 py-0.5 font-medium text-xs bg-primary/10 text-primary border-primary/20"
            >
              {documentYear}
            </Badge>

            {hasStatusHistory && (
              <StatusHistoryPopover
                statusHistory={doc.status_history}
              />
            )}
          </div>

          {/* Title */}
          <h2 className="text-base font-medium transition-colors sm:text-lg group-hover:text-primary line-clamp-2">
            {doc.title}
          </h2>

          {/* Creation Date and Uploader */}
          <div className="flex items-center justify-between mt-2">
            <CardDescription className="flex items-center gap-1 text-xs">
              <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
              {new Date(doc.created_at).toLocaleDateString()}
            </CardDescription>
            {doc.uploaded_by && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span className="hidden sm:inline">By</span>
                      <Avatar className="w-5 h-5 border-[1px] border-primary/10">
                        <AvatarImage
                          src={doc.uploaded_by.avatar || ''}
                          alt={doc.uploaded_by.username || doc.uploaded_by.email}
                        />
                        <AvatarFallback className="text-[10px] bg-primary/5 text-primary">
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
        </div>
      </div>

      {/* Tags Section */}
      <div className="flex-grow px-4 pt-2 pb-1">
        {tags && tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {tags.slice(0, 3).map((tag, idx) => (
              <Badge
                key={idx}
                variant="secondary"
                className="text-xs bg-secondary/40 hover:bg-secondary/60 px-2.5 py-1 rounded-full gap-1.5"
              >
                <Tag className="w-3 h-3" />
                {tag.name}
              </Badge>
            ))}
            {tags.length > 3 && (
              <Badge variant="outline" className="text-xs px-2.5 py-1 rounded-full">
                +{tags.length - 3}
              </Badge>
            )}
          </div>
        )}
      </div>

      {/* Document Metadata */}
      <div className="px-4 pb-3">
        <div className="grid grid-cols-2 mt-2 text-xs gap-x-3 gap-y-2">
          <div className="flex items-center gap-2 p-2 overflow-hidden border rounded-lg bg-background/50 backdrop-blur-sm">
            <div className="p-1.5 rounded-md bg-primary/5">
              <Layers className="w-3.5 h-3.5 text-primary/70 flex-shrink-0" />
            </div>
            <span className="font-medium truncate">{doc.no_of_chunks || 0} chunks</span>
          </div>

          <div className="flex items-center gap-2 p-2 overflow-hidden border rounded-lg bg-background/50 backdrop-blur-sm">
            <div className="p-1.5 rounded-md bg-primary/5">
              {ConverterIcon ?
                <ConverterIcon className="w-3.5 h-3.5 text-primary/70 flex-shrink-0" /> :
                <FileText className="w-3.5 h-3.5 text-primary/70 flex-shrink-0" />
              }
            </div>
            <span className="font-medium truncate">
              {doc.markdown_converter && MARKDOWN_CONVERTERS[doc.markdown_converter]
                ? MARKDOWN_CONVERTERS[doc.markdown_converter].label
                : "Unknown converter"}
            </span>
          </div>

          <div className="flex items-center gap-2 p-2 overflow-hidden border rounded-lg bg-background/50 backdrop-blur-sm">
            <div className="p-1.5 rounded-md bg-primary/5">
              <FileText className="w-3.5 h-3.5 text-primary/70 flex-shrink-0" />
            </div>
            <span className="font-medium truncate" title={doc.file_name}>{doc.file_name}</span>
          </div>

          <div className="flex items-center gap-2 p-2 overflow-hidden border rounded-lg bg-background/50 backdrop-blur-sm">
            <div className="p-1.5 rounded-md bg-primary/5">
              <Book className="w-3.5 h-3.5 text-primary/70 flex-shrink-0" />
            </div>
            <span className="font-medium truncate">{doc.page_count || 0} pages</span>
          </div>

          <div className="flex items-center col-span-2 gap-2 p-2 overflow-hidden border rounded-lg bg-background/50 backdrop-blur-sm">
            <div className="p-1.5 rounded-md bg-primary/5">
              <Tag className="w-3.5 h-3.5 text-primary/70 flex-shrink-0" />
            </div>
            <span className="font-medium truncate">{doc.summarization_model}</span>
          </div>
        </div>
      </div>

      {/* Footer - Fixed at bottom, always visible */}
      <div className="flex items-center justify-between p-3 mt-auto border-t">
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-muted-foreground group-hover:text-primary group-hover:font-medium transition-all rounded-full px-4 text-xs sm:text-sm"
          onClick={() => navigate(`/documents/${doc.id}`)}
        >
          <span>View details</span>
          <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="w-8 h-8 rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10"
            >
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="border rounded-lg shadow-lg">
            <DropdownMenuItem
              className="flex items-center gap-2"
              onClick={(e) => {
                e.stopPropagation();
                setIsModelDialogOpen(true);
              }}
              disabled={regenerateSummaryMutation.isPending}
            >
              {regenerateSummaryMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-2" />
              )}
              Regenerate Summary
            </DropdownMenuItem>
            {!(doc.preview_image && doc.blurhash) && (
              <DropdownMenuItem
                className="flex items-center gap-2"
                onClick={(e) => {
                  e.stopPropagation();
                  regeneratePreviewMutation.mutate();
                }}
                disabled={regeneratePreviewMutation.isPending}
              >
                {regeneratePreviewMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <RotateCw className="w-4 h-4 mr-2" />
                )}
                Generate Preview
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled className="text-xs text-muted-foreground">
              Re-extract with:
            </DropdownMenuItem>
            {Object.entries(MARKDOWN_CONVERTERS).map(([key, converter]) => (
              <DropdownMenuItem
                key={key}
                className="flex items-center gap-2"
                onClick={(e) => {
                  e.stopPropagation();
                  reextractMutation.mutate(key);
                }}
                disabled={reextractMutation.isPending}
              >
                {reextractMutation.isPending ? (
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
                handleDeleteMutation.mutate();
              }}
              disabled={handleDeleteMutation.isPending}
            >
              {handleDeleteMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Trash className="w-4 h-4 mr-2" />
              )}
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Model Selection Dialog */}
      <Dialog open={isModelDialogOpen} onOpenChange={setIsModelDialogOpen}>
        <DialogContent className="rounded-lg sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Regenerate Summary</DialogTitle>
            <DialogDescription>
              Select a model to use for regenerating the summary.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Summarization Model</label>
              <ModelSelector modelId={selectedModel?.id} onModelChange={handleModelChange} />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsModelDialogOpen(false)}
              disabled={regenerateSummaryMutation.isPending}
              className="rounded-full"
            >
              Cancel
            </Button>
            <Button
              onClick={handleRegenerateSummary}
              disabled={!selectedModel || regenerateSummaryMutation.isPending}
              className="rounded-full"
            >
              {regenerateSummaryMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                "Regenerate"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
