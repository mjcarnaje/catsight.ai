import { Markdown } from "@/components/markdown";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { api, getDocumentPreviewUrl } from "@/lib/api";
import { getStatusConfig } from "@/lib/document-status-config";
import { MARKDOWN_CONVERTERS } from "@/lib/markdown-converter";
import { cn } from "@/lib/utils";
import { Document } from "@/types";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  ArrowLeft,
  Book,
  Calendar,
  Download,
  Edit,
  Eye,
  FileCode,
  FileText,
  Layers,
  Loader2,
  SplitSquareVertical,
  Tag,
} from "lucide-react";
import { useState } from "react";
import { Blurhash } from "react-blurhash";
import { useNavigate, useParams } from "react-router-dom";

export function DocumentViewPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [imageLoaded, setImageLoaded] = useState(false);

  const { isLoading, error, data } = useQuery({
    queryKey: ["document", id],
    queryFn: () =>
      api.get<Document>(`/documents/${id}`).then((res) => res.data),
  });

  const handleEditClick = () => navigate(`/documents/${id}/edit`);
  const handlePdfViewClick = () => navigate(`/documents/${id}/pdf`);
  const handleMarkdownViewClick = () => navigate(`/documents/${id}/markdown`);
  const handleComparisonViewClick = () => navigate(`/documents/${id}/comparison`);
  const handleBackClick = () => navigate("/documents");

  // Loading skeleton
  if (isLoading) {
    return (
      <div className="container max-w-6xl py-10 mx-auto space-y-8">
        <Skeleton className="w-32 h-9" />
        <Skeleton className="w-full h-14 rounded-xl" />
        <div className="grid gap-10 md:grid-cols-2">
          <Skeleton className="w-full h-[460px] rounded-xl" />
          <div className="space-y-5">
            <Skeleton className="w-3/4 h-7" />
            <Skeleton className="w-full h-40 rounded-xl" />
            <Skeleton className="w-full h-28 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="container flex flex-col items-center justify-center min-h-[70vh] mx-auto">
        <div className="max-w-md p-8 text-center border shadow-lg rounded-xl bg-gradient-to-b from-white to-muted/20">
          <div className="flex items-center justify-center w-16 h-16 mx-auto mb-6 rounded-full bg-muted/30 backdrop-blur-sm">
            <FileText className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="mb-3 text-xl font-medium">
            {error ? "Error Loading Document" : "Document Not Found"}
          </h3>
          <p className="mb-6 text-muted-foreground">
            {error
              ? "There was a problem loading this document."
              : "The document you're looking for doesn't exist or has been deleted."}
          </p>
          <Button
            onClick={handleBackClick}
            className="gap-2 px-6 rounded-full shadow-sm"
            size="lg"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Documents
          </Button>
        </div>
      </div>
    );
  }

  const statusInfo = getStatusConfig(data.status);
  const formattedDate = format(new Date(data.updated_at), "PPP");
  const previewImageUrl = getDocumentPreviewUrl(data.preview_image);
  const tags = data.tags || [];
  const converterName = data.markdown_converter
    ? MARKDOWN_CONVERTERS[data.markdown_converter].label
    : "None";

  return (
    <div className="container max-w-6xl py-10 mx-auto">
      {/* Header with navigation and actions */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <Button
          variant="ghost"
          onClick={handleBackClick}
          className="gap-2 px-4 rounded-full hover:bg-muted/50"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </Button>

        <div className="flex items-center gap-3">
          <Badge
            variant="outline"
            className={cn(
              "rounded-full px-4 py-1.5 font-medium shadow-sm",
              statusInfo.bg,
              statusInfo.border,
              statusInfo.text
            )}
          >
            {statusInfo.showLoading ? (
              <>
                <Loader2 className="w-3.5 mr-1.5 h-3.5 animate-spin" />
                {statusInfo.label}
              </>
            ) : (
              statusInfo.label
            )}
          </Badge>

          <Button
            onClick={handleEditClick}
            className="gap-2 px-5 rounded-full shadow-sm"
          >
            <Edit className="w-4 h-4" />
            Edit
          </Button>
        </div>
      </div>

      {/* Main content */}
      <div className="grid gap-10 lg:grid-cols-[1fr_1.5fr]">
        {/* Left column: Document preview */}
        <div className="space-y-6">
          <div className="overflow-hidden transition-all border rounded-xl shadow-md bg-gradient-to-b from-muted/5 to-muted/20 hover:shadow-lg aspect-[210/297]">
            {data.preview_image ? (
              <>
                {!imageLoaded && data.blurhash && (
                  <Blurhash
                    hash={data.blurhash}
                    width="100%"
                    height="100%"
                    resolutionX={32}
                    resolutionY={32}
                    punch={1}
                  />
                )}
                <img
                  src={previewImageUrl}
                  alt={data.title}
                  className={`w-full h-full object-contain transition-all duration-500 ${imageLoaded ? "opacity-100 scale-100" : "opacity-0 scale-95"
                    }`}
                  onLoad={() => setImageLoaded(true)}
                />
              </>
            ) : (
              <div className="flex items-center justify-center w-full h-full">
                <FileText className="w-20 h-20 text-muted-foreground/30" />
              </div>
            )}
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">{data.file_name}</p>
              <p className="text-sm text-muted-foreground">{data.file_type}</p>
            </div>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handlePdfViewClick}
                    className="rounded-full shadow-sm"
                  >
                    <Eye className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>View PDF</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          {/* Quick stats */}
          <div className="grid grid-cols-3 gap-4 py-4">
            <div className="p-4 transition-all border shadow-sm rounded-xl bg-gradient-to-br from-white to-muted/10 hover:shadow-md">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-muted-foreground">Pages</span>
                <Book className="w-3.5 h-3.5 text-primary/70" />
              </div>
              <p className="text-2xl font-medium">{data.page_count || 0}</p>
            </div>

            <div className="p-4 transition-all border shadow-sm rounded-xl bg-gradient-to-br from-white to-muted/10 hover:shadow-md">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-muted-foreground">Chunks</span>
                <Layers className="w-3.5 h-3.5 text-primary/70" />
              </div>
              <p className="text-2xl font-medium">{data.no_of_chunks || 0}</p>
            </div>

            <div className="p-4 transition-all border shadow-sm rounded-xl bg-gradient-to-br from-white to-muted/10 hover:shadow-md">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-muted-foreground">Year</span>
                <Calendar className="w-3.5 h-3.5 text-primary/70" />
              </div>
              <p className="text-2xl font-medium">{data.year}</p>
            </div>
          </div>

          {/* Document actions */}
          <div className="grid grid-cols-3 gap-4">
            <Button
              variant="outline"
              className="flex flex-col items-center justify-center h-auto gap-2 py-4 transition-all bg-white border shadow-sm rounded-xl hover:bg-primary/5 hover:shadow-md"
              onClick={handlePdfViewClick}
            >
              <Eye className="w-5 h-5 text-primary/80" />
              <span className="text-xs font-medium">PDF</span>
            </Button>

            <Button
              variant="outline"
              className="flex flex-col items-center justify-center h-auto gap-2 py-4 transition-all bg-white border shadow-sm rounded-xl hover:bg-primary/5 hover:shadow-md"
              onClick={handleMarkdownViewClick}
            >
              <FileCode className="w-5 h-5 text-primary/80" />
              <span className="text-xs font-medium">Markdown</span>
            </Button>

            <Button
              variant="outline"
              className="flex flex-col items-center justify-center h-auto gap-2 py-4 transition-all bg-white border shadow-sm rounded-xl hover:bg-primary/5 hover:shadow-md"
              onClick={handleComparisonViewClick}
            >
              <SplitSquareVertical className="w-5 h-5 text-primary/80" />
              <span className="text-xs font-medium">Compare</span>
            </Button>
          </div>
        </div>

        {/* Right column: Document details */}
        <div className="space-y-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
              {data.title}
            </h1>
            <div className="flex items-center gap-3 mt-3 text-sm text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4" />
                <span>Updated {formattedDate}</span>
              </div>

              {data.markdown_converter && (
                <>
                  <div className="w-1 h-1 rounded-full bg-muted-foreground/50"></div>
                  <span>Converter: {converterName}</span>
                </>
              )}
            </div>
          </div>

          {/* Tags */}
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {tags.map((tag, index) => (
                <Badge
                  key={index}
                  variant="secondary"
                  className="px-3 py-1.5 gap-1.5 rounded-full shadow-sm"
                >
                  <Tag className="w-3 h-3" />
                  {tag.name}
                </Badge>
              ))}
            </div>
          )}

          {/* Summary */}
          <div className="p-6 bg-white border shadow-sm rounded-xl">
            <h2 className="mb-3 text-sm font-medium text-muted-foreground">Summary</h2>
            {data.summary ? (
              <Markdown
                content={data.summary}
                className="prose-sm max-w-none prose-p:my-1.5 prose-headings:my-2"
              />
            ) : (
              <p className="text-sm italic text-muted-foreground">
                No summary provided for this document.
              </p>
            )}
          </div>

          {/* Basic info */}
          <div className="p-6 border shadow-sm rounded-xl bg-gradient-to-br from-white to-muted/5">
            <h2 className="mb-4 text-sm font-medium text-muted-foreground">Document Information</h2>
            <div className="grid grid-cols-2 text-sm gap-y-4">
              <div className="font-medium text-muted-foreground">File Type</div>
              <div className="font-mono bg-muted/20 px-2 py-0.5 rounded-md inline-block">{data.file_type}</div>

              <div className="font-medium text-muted-foreground">Created</div>
              <div>{format(new Date(data.created_at), "PPP")}</div>

              <div className="font-medium text-muted-foreground">Converter</div>
              <div>{converterName}</div>

              {data.uploaded_by && (
                <>
                  <div className="font-medium text-muted-foreground">Uploaded By</div>
                  <div>
                    {data.uploaded_by.first_name && data.uploaded_by.last_name
                      ? `${data.uploaded_by.first_name} ${data.uploaded_by.last_name}`
                      : data.uploaded_by.email}
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="flex justify-end mt-4">
            <Button
              variant="ghost"
              className="gap-2 text-muted-foreground hover:text-foreground"
              size="sm"
            >
              <Download className="w-4 h-4" />
              Download Original
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
