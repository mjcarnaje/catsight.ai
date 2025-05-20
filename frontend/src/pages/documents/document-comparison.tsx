import MarkdownPreview from "@/components/markdown-preview";
import PDFViewerContentOnly from "@/components/pdf-viewer-content-only";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { Document } from "@/types";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Edit,
  Eye,
  FileCode,
  SplitSquareVertical,
  FileText,
  Loader2,
  Download,
} from "lucide-react";
import { useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function DocumentComparisonPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const chunk_index = searchParams.get("chunk_index");
  const highlight = searchParams.get("highlight");
  const [activeTab, setActiveTab] = useState(chunk_index ? "chunks" : "full");

  const navigate = useNavigate();

  const { isLoading: isDocLoading, data: documentData } = useQuery({
    queryKey: ["document", id],
    queryFn: () =>
      api.get<Document>(`/documents/${id}`).then((res) => res.data),
  });

  const {
    isLoading: isMarkdownLoading,
    error: markdownError,
    data: markdownData,
  } = useQuery({
    queryKey: ["doc-md", id],
    queryFn: () =>
      api
        .get<{ content: string; chunks: string[] }>(`/documents/${id}/markdown`)
        .then((r) => r.data),
  });

  const { isLoading: isPdfLoading, data: blobUrl } = useQuery({
    queryKey: ["pdf", id],
    queryFn: async () => {
      const res = await fetch(`/api/documents/${id}/raw/`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("access_token")}`,
        },
      });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      return URL.createObjectURL(blob);
    },
  });

  const handleBackClick = () => navigate(`/documents/${id}`);
  const handleEditClick = () => navigate(`/documents/${id}/edit`);
  const handlePdfViewClick = () => navigate(`/documents/${id}/pdf`);
  const handleMarkdownViewClick = () => navigate(`/documents/${id}/markdown`);
  const handleDownloadPdf = () => {
    if (blobUrl) {
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = documentData?.file_name || "document.pdf";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  if (isDocLoading || isMarkdownLoading || isPdfLoading) {
    return (
      <div className="container z-10 max-w-6xl py-10 mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Skeleton className="w-10 h-10 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="w-48 h-8" />
              <Skeleton className="w-32 h-5" />
            </div>
          </div>
          <div className="flex gap-3">
            <Skeleton className="h-10 rounded-full w-28" />
            <Skeleton className="h-10 rounded-full w-28" />
          </div>
        </div>
        <Skeleton className="w-full h-[calc(100vh-180px)] rounded-xl shadow-sm" />
      </div>
    );
  }

  if (!documentData) {
    return (
      <div className="container z-10 flex flex-col items-center justify-center min-h-[70vh] mx-auto">
        <div className="max-w-md p-8 text-center border shadow-lg rounded-xl bg-gradient-to-b from-white to-muted/20">
          <div className="flex items-center justify-center w-16 h-16 mx-auto mb-6 rounded-full bg-muted/30 backdrop-blur-sm">
            <FileText className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="mb-3 text-xl font-medium">Document Not Found</h3>
          <p className="mb-6 text-muted-foreground">
            The document you're looking for doesn't exist or has been deleted.
          </p>
          <Button
            onClick={() => navigate("/documents")}
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

  if (markdownError || !markdownData) {
    return (
      <div className="container z-10 flex flex-col items-center justify-center min-h-[70vh] mx-auto">
        <div className="max-w-md p-8 text-center border shadow-lg rounded-xl bg-gradient-to-b from-white to-muted/20">
          <div className="flex items-center justify-center w-16 h-16 mx-auto mb-6 rounded-full bg-red-50 backdrop-blur-sm">
            <FileText className="w-8 h-8 text-red-500" />
          </div>
          <h3 className="mb-3 text-xl font-medium">
            Error Loading Document
          </h3>
          <p className="mb-6 text-muted-foreground">
            There was a problem loading the document content.
          </p>
          <Button
            onClick={handleBackClick}
            className="gap-2 px-6 rounded-full shadow-sm"
            size="lg"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Document
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container z-10 max-w-6xl py-10 mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleBackClick}
            className="rounded-full hover:bg-muted/50"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
                {documentData.title}
              </h1>
              <Badge
                variant="outline"
                className="px-3 py-1 font-medium text-purple-600 border-purple-200 rounded-full shadow-sm bg-purple-500/10"
              >
                Comparison
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Side-by-side comparison view
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleDownloadPdf}
                  className="rounded-full shadow-sm"
                  disabled={!blobUrl}
                >
                  <Download className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Download PDF</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <Button
            variant="outline"
            onClick={handlePdfViewClick}
            className="gap-2 px-4 rounded-full"
          >
            <Eye className="w-4 h-4" />
            <span className="hidden sm:inline">View</span> PDF
          </Button>

          <Button
            variant="outline"
            onClick={handleMarkdownViewClick}
            className="gap-2 px-4 rounded-full"
          >
            <FileCode className="w-4 h-4" />
            <span className="hidden sm:inline">View</span> Markdown
          </Button>

          <Button
            onClick={handleEditClick}
            className="gap-2 px-5 rounded-full shadow-sm"
          >
            <Edit className="w-4 h-4" />
            Edit
          </Button>
        </div>
      </div>

      {/* Comparison Viewer */}
      <Card className="overflow-hidden border shadow-md rounded-xl">
        <CardContent className="p-0 overflow-hidden">
          <div className="flex items-center justify-between p-3 border-b bg-gradient-to-r from-muted/10 to-muted/5">
            <div className="flex items-center gap-2">
              <SplitSquareVertical className="w-4 h-4 text-primary/70" />
              <h2 className="text-sm font-medium">Side-by-Side Comparison</h2>
            </div>
            <Button
              variant="ghost"
              onClick={handleBackClick}
              className="gap-2 px-3 py-1.5 text-xs rounded-full"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to Details
            </Button>
          </div>

          <ResizablePanelGroup direction="horizontal" className="max-h-[80vh]">
            <ResizablePanel defaultSize={50} minSize={30}>
              <div className="flex flex-col h-full border-r">
                <div className="flex items-center justify-between p-3 border-b bg-gradient-to-r from-blue-50/50 to-blue-50/20">
                  <h3 className="flex items-center gap-2 text-sm font-medium">
                    <Eye className="w-4 h-4 text-blue-500/70" />
                    Original PDF
                  </h3>
                </div>

                <div className="flex-1 overflow-hidden">
                  {isPdfLoading ? (
                    <div className="flex flex-col items-center justify-center w-full h-full gap-3">
                      <Loader2 className="w-12 h-12 animate-spin text-primary/70" />
                      <p className="text-sm text-muted-foreground">Loading PDF document...</p>
                    </div>
                  ) : blobUrl ? (
                    <PDFViewerContentOnly url={blobUrl} />
                  ) : (
                    <div className="flex flex-col items-center justify-center w-full h-full">
                      <div className="flex items-center justify-center w-16 h-16 mb-4 rounded-full bg-muted/30 backdrop-blur-sm">
                        <FileText className="w-8 h-8 text-muted-foreground" />
                      </div>
                      <p className="mb-2 text-muted-foreground">
                        Unable to load PDF
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </ResizablePanel>

            <ResizableHandle withHandle className="transition-colors bg-muted/30 hover:bg-muted/50" />

            <ResizablePanel defaultSize={50} minSize={30}>
              <div className="flex flex-col h-full">
                <div className="flex items-center justify-between p-3 border-b bg-gradient-to-r from-emerald-50/50 to-emerald-50/20">
                  <h3 className="flex items-center gap-2 text-sm font-medium">
                    <FileCode className="w-4 h-4 text-emerald-500/70" />
                    Markdown Content
                  </h3>
                </div>
                <div className="flex-1 p-6 overflow-auto bg-white">
                  <MarkdownPreview content={markdownData.content} />
                </div>
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>
        </CardContent>
      </Card>
    </div>
  );
}
