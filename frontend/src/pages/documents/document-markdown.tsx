import ChunkViewer from "@/components/chunk-viewer";
import MarkdownPreview from "@/components/markdown-preview";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/api";
import { Document } from "@/types";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Edit, FileText, Eye, SplitSquareVertical, Download, Loader2 } from "lucide-react";
import { useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function DocumentMarkdownPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const chunk_index = searchParams.get("chunk_index");
  const highlight = searchParams.get("highlight");
  const [activeTab, setActiveTab] = useState(chunk_index ? "chunks" : "full");

  const navigate = useNavigate();

  const { isLoading: isDocLoading, data: documentData } = useQuery({
    queryKey: ["document", id],
    queryFn: () => api.get<Document>(`/documents/${id}`).then((res) => res.data),
  });

  const { isLoading: isMarkdownLoading, error: markdownError, data: markdownData } = useQuery({
    queryKey: ["doc-md", id],
    queryFn: () => api.get<{ content: string; chunks: string[] }>(`/documents/${id}/markdown`).then((r) => r.data),
  });

  const handleBackClick = () => navigate(`/documents/${id}`);
  const handleEditClick = () => navigate(`/documents/${id}/edit`);
  const handlePdfViewClick = () => navigate(`/documents/${id}/pdf`);
  const handleComparisonViewClick = () => navigate(`/documents/${id}/comparison`);
  const handleDownload = () => {
    if (markdownData?.content) {
      const blob = new Blob([markdownData.content], { type: "text/markdown" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${documentData?.title || "document"}.md`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  if (isDocLoading || isMarkdownLoading) {
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
          <p className="mb-6 text-muted-foreground">The document you're looking for doesn't exist or has been deleted.</p>
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
          <h3 className="mb-3 text-xl font-medium">Error Loading Markdown</h3>
          <p className="mb-6 text-muted-foreground">There was a problem loading the markdown content.</p>
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
              <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{documentData.title}</h1>
              <Badge
                variant="outline"
                className="px-3 py-1 font-medium rounded-full shadow-sm bg-emerald-500/10 text-emerald-600 border-emerald-200"
              >
                Markdown
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Viewing markdown content
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
                  onClick={handleDownload}
                  className="rounded-full shadow-sm"
                >
                  <Download className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Download Markdown</TooltipContent>
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
            onClick={handleComparisonViewClick}
            className="gap-2 px-4 rounded-full"
          >
            <SplitSquareVertical className="w-4 h-4" />
            <span className="hidden sm:inline">Side-by-side</span> View
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

      {/* Markdown Viewer */}
      <Card className="overflow-hidden border shadow-md rounded-xl">
        <CardContent className="p-0 overflow-hidden">
          <div className="w-full h-[calc(100vh-180px)] border-t">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full h-full">
              <div className="flex items-center justify-between p-3 border-b bg-gradient-to-r from-muted/10 to-muted/5">
                <TabsList className="h-10 p-1 bg-muted/20 backdrop-blur-sm">
                  <TabsTrigger value="full" className="px-5 text-xs rounded-full">
                    Full Document
                  </TabsTrigger>
                  <TabsTrigger value="chunks" className="px-5 text-xs rounded-full">
                    Chunks
                    <span className="ml-1.5 px-1.5 py-0.5 text-[10px] rounded-full bg-primary/10">
                      {markdownData.chunks.length}
                    </span>
                  </TabsTrigger>
                </TabsList>
                <div className="px-3 py-1 text-xs rounded-full bg-muted/20 text-muted-foreground">
                  {activeTab === "full" ? "Viewing complete document" : `Viewing chunks (${markdownData.chunks.length})`}
                </div>
              </div>

              <TabsContent value="full" className="p-0 m-0 h-[calc(100%-56px)]">
                <div className="h-full p-6 overflow-auto">
                  <MarkdownPreview content={markdownData.content} />
                </div>
              </TabsContent>

              <TabsContent value="chunks" className="p-0 m-0 h-[calc(100%-56px)]">
                <div className="h-full p-5 overflow-auto">
                  <ChunkViewer
                    chunks={markdownData.chunks}
                    chunk_index={chunk_index}
                    highlight={highlight}
                  />
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 