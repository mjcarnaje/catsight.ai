import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { api, getDocumentPreviewUrl } from "@/lib/api";
import { Document } from "@/types";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  ArrowLeft,
  Calendar,
  ChevronRight,
  Edit,
  Eye,
  FileText,
  FilePlus2,
  Grid3X3,
  Layers,
  Tag,
  User,
  Loader2,
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { Blurhash } from "react-blurhash";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { MARKDOWN_CONVERTERS } from "@/lib/markdown-converter";
import { cn } from "@/lib/utils";
import { Markdown } from "@/components/markdown";
import { DOCUMENT_STATUS_CONFIG } from "@/lib/document-status-config";

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
  const handleComparisonViewClick = () =>
    navigate(`/documents/${id}/comparison`);
  const handleBackClick = () => navigate("/documents");

  // Loading skeleton
  if (isLoading) {
    return (
      <div className="container py-8 mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="w-12 h-12 rounded-full" />
            <Skeleton className="w-48 h-8" />
          </div>
          <Skeleton className="w-32 h-10 rounded-full" />
        </div>
        <div className="grid gap-8 md:grid-cols-[1fr_2fr]">
          <Skeleton className="w-full h-[400px] rounded-xl" />
          <div className="space-y-4">
            <Skeleton className="w-3/4 h-10" />
            <Skeleton className="w-full h-32" />
            <div className="grid grid-cols-2 gap-4">
              <Skeleton className="w-full h-24 rounded-lg" />
              <Skeleton className="w-full h-24 rounded-lg" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container flex flex-col items-center justify-center min-h-[70vh] mx-auto">
        <div className="p-8 text-center border shadow-inner rounded-xl bg-card/50">
          <div className="p-6 mx-auto mb-6 rounded-full w-fit bg-destructive/10">
            <FileText className="w-12 h-12 text-destructive" />
          </div>
          <h3 className="mb-2 text-2xl font-semibold">
            Error Loading Document
          </h3>
          <p className="mb-6 text-muted-foreground">
            There was a problem loading this document.
          </p>
          <Button
            variant="outline"
            onClick={handleBackClick}
            className="gap-2 rounded-full"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Documents
          </Button>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="container flex flex-col items-center justify-center min-h-[70vh] mx-auto">
        <div className="p-8 text-center border shadow-inner rounded-xl bg-card/50">
          <div className="p-6 mx-auto mb-6 rounded-full w-fit bg-muted">
            <FileText className="w-12 h-12 text-muted-foreground" />
          </div>
          <h3 className="mb-2 text-2xl font-semibold">Document Not Found</h3>
          <p className="mb-6 text-muted-foreground">
            The document you're looking for doesn't exist or has been deleted.
          </p>
          <Button
            variant="outline"
            onClick={handleBackClick}
            className="gap-2 rounded-full"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Documents
          </Button>
        </div>
      </div>
    );
  }

  const statusInfo = DOCUMENT_STATUS_CONFIG[data.status];
  const formattedCreatedDate = format(new Date(data.created_at), "PPP");
  const formattedUpdatedDate = format(new Date(data.updated_at), "PPP");
  const previewImageUrl = getDocumentPreviewUrl(data.preview_image);

  const ConverterIcon = data.markdown_converter
    ? MARKDOWN_CONVERTERS[data.markdown_converter].icon
    : null;

  const tags = data.tags || [];

  return (
    <div className="min-h-screen">
      {/* Hero Header */}
      <div className="relative py-8 overflow-hidden border-b">
        <div className="absolute inset-0 opacity-5">
          <div
            className="absolute inset-0 bg-grid-primary/[0.1]"
            style={{ backgroundSize: "30px 30px" }}
          ></div>
        </div>
        <div className="container relative z-10 mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleBackClick}
              className="flex-shrink-0 rounded-full hover:bg-primary/5"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <Badge
              variant="outline"
              className={cn(
                `rounded-full px-3 py-0.5 font-medium text-xs transition-colors whitespace-nowrap`,
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
                <>{statusInfo.label}</>
              )}
            </Badge>

            {/* Display Year */}
            <Badge
              variant="secondary"
              className="rounded-full px-3 py-0.5 font-medium text-xs bg-primary/10 text-primary border-primary/20"
            >
              {data.year}
            </Badge>
          </div>

          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
                {data.title}
              </h1>
              <div className="mt-2 text-muted-foreground">
                {data.summary ? (
                  <Markdown
                    content={data.summary}
                    className="prose-sm prose-p:my-1 prose-headings:my-1"
                  />
                ) : (
                  "No summary provided for this document."
                )}
              </div>

              {/* Display Tags */}
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {tags.map((tag, index) => (
                    <Badge
                      key={index}
                      variant="outline"
                      className="px-3 py-1 transition-colors rounded-full bg-secondary/40 hover:bg-secondary/60 border-secondary/20"
                    >
                      <Tag className="w-3 h-3 mr-1" />
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-3">
              <Button
                onClick={handleEditClick}
                className="gap-2 rounded-full shadow-sm"
              >
                <Edit className="w-4 h-4" />
                Edit Document
              </Button>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={handlePdfViewClick}
                      className="rounded-full"
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>View PDF</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
        </div>
      </div>

      <div className="container py-8 mx-auto">
        <div className="grid gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]">
          {/* Document Preview */}
          <div className="space-y-6">
            <h2 className="text-xl font-semibold">Document Preview</h2>
            <Card className="overflow-hidden border shadow">
              <div className="relative flex items-center justify-center overflow-hidden bg-muted/30 aspect-[210/297] w-full">
                {data.preview_image ? (
                  <>
                    {!imageLoaded && data.blurhash && (
                      <div className="absolute inset-0">
                        <Blurhash
                          hash={data.blurhash}
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
                      alt={data.title}
                      className={`w-full h-full object-contain transition-opacity duration-500 ${imageLoaded ? "opacity-100" : "opacity-0"
                        }`}
                      onLoad={() => setImageLoaded(true)}
                    />
                  </>
                ) : (
                  <FileText className="w-16 h-16 text-muted-foreground/40" />
                )}
              </div>
              <div className="p-4 text-center border-t bg-card">
                <p className="font-medium">{data.file_name}</p>
                <p className="text-sm text-muted-foreground">
                  {data.file_type}
                </p>
              </div>
            </Card>
          </div>

          {/* Document Details */}
          <div className="space-y-8">
            {/* File Information */}
            <div>
              <h2 className="mb-4 text-xl font-semibold">
                Document Information
              </h2>
              <Card className="overflow-hidden shadow-sm">
                <CardContent className="p-0">
                  <div className="grid grid-cols-1 lg:grid-cols-2">
                    <div className="p-5 border-b lg:border-r lg:border-b-0">
                      <h3 className="mb-4 text-sm font-medium text-muted-foreground">
                        Basic Information
                      </h3>
                      <div className="grid grid-cols-[120px_1fr] gap-y-3 text-sm">
                        <div className="font-medium">File Type</div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="font-normal">
                            {data.file_type}
                          </Badge>
                        </div>

                        <div className="font-medium">Created</div>
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                          {formattedCreatedDate}
                        </div>

                        <div className="font-medium">Updated</div>
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                          {formattedUpdatedDate}
                        </div>

                        <div className="font-medium">Year</div>
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                          <Badge className="font-medium border-none bg-primary/10 text-primary hover:bg-primary/20">
                            {data.year}
                          </Badge>
                        </div>

                        <div className="font-medium">Tags</div>
                        <div className="flex flex-wrap items-center gap-2">
                          {tags.length > 0 ? (
                            tags.map((tag, index) => (
                              <Badge
                                key={index}
                                className="border-none bg-secondary/40 hover:bg-secondary/60 text-secondary-foreground"
                              >
                                {tag}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-xs italic text-muted-foreground">
                              No tags
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="p-5 border-t lg:border-t-0">
                      <h3 className="mb-4 text-sm font-medium text-muted-foreground">
                        Processing Information
                      </h3>
                      <div className="grid grid-cols-[120px_1fr] gap-y-3 text-sm">
                        <div className="font-medium">Chunks</div>
                        <div className="flex items-center gap-2">
                          <div className="px-2.5 py-1 rounded-full bg-muted w-fit text-xs font-medium">
                            <span className="flex items-center gap-1">
                              <Layers className="w-3 h-3" />
                              {data.no_of_chunks || 0}
                            </span>
                          </div>
                        </div>

                        <div className="font-medium">Converter</div>
                        <div className="flex items-center gap-1">
                          {ConverterIcon && (
                            <ConverterIcon className="w-3.5 h-3.5 text-muted-foreground" />
                          )}
                          <span>
                            {data.markdown_converter &&
                              MARKDOWN_CONVERTERS[data.markdown_converter]
                                .label}
                          </span>
                        </div>

                        {data.uploaded_by && (
                          <>
                            <div className="font-medium">Uploaded By</div>
                            <div className="flex items-center gap-1">
                              <User className="w-3.5 h-3.5 text-muted-foreground" />
                              {data.uploaded_by.first_name &&
                                data.uploaded_by.last_name
                                ? `${data.uploaded_by.first_name} ${data.uploaded_by.last_name}`
                                : data.uploaded_by.email}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Document Actions */}
            <div>
              <h2 className="mb-4 text-xl font-semibold">Document Actions</h2>
              <div className="grid gap-4 sm:grid-cols-3">
                <Card
                  className="overflow-hidden transition-all shadow-sm hover:shadow-md hover:border-primary/30"
                  onClick={handlePdfViewClick}
                >
                  <CardContent className="p-5 cursor-pointer">
                    <div className="flex items-center gap-4">
                      <div className="p-2.5 rounded-lg bg-primary/5">
                        <Eye className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-medium">View PDF</h3>
                        <p className="text-xs text-muted-foreground">
                          Original document
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card
                  className="overflow-hidden transition-all shadow-sm hover:shadow-md hover:border-primary/30"
                  onClick={handleMarkdownViewClick}
                >
                  <CardContent className="p-5 cursor-pointer">
                    <div className="flex items-center gap-4">
                      <div className="p-2.5 rounded-lg bg-primary/5">
                        <FilePlus2 className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-medium">View Markdown</h3>
                        <p className="text-xs text-muted-foreground">
                          Extracted content
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card
                  className="overflow-hidden transition-all shadow-sm hover:shadow-md hover:border-primary/30"
                  onClick={handleComparisonViewClick}
                >
                  <CardContent className="p-5 cursor-pointer">
                    <div className="flex items-center gap-4">
                      <div className="p-2.5 rounded-lg bg-primary/5">
                        <Grid3X3 className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-medium">Side-by-Side View</h3>
                        <p className="text-xs text-muted-foreground">
                          Compare documents
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
