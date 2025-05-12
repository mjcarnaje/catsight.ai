import ChunkViewer from "@/components/chunk-viewer";
import MarkdownPreview from "@/components/markdown-preview";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/api";
import { Document } from "@/types";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Edit, FileText, Grid3X3, LayoutPanelTop } from "lucide-react";
import { useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Badge } from "@/components/ui/badge";

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

  if (isDocLoading || isMarkdownLoading) {
    return (
      <div className="container py-8 mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Skeleton className="w-10 h-10 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="w-48 h-7" />
              <Skeleton className="w-32 h-4" />
            </div>
          </div>
          <div className="flex gap-2">
            <Skeleton className="w-24 rounded-full h-9" />
            <Skeleton className="w-24 rounded-full h-9" />
          </div>
        </div>
        <Skeleton className="w-full h-[calc(100vh-180px)] rounded-lg" />
      </div>
    );
  }

  if (!documentData) {
    return (
      <div className="container flex flex-col items-center justify-center min-h-[70vh] mx-auto">
        <div className="p-8 text-center border shadow-inner rounded-xl bg-card/50">
          <div className="p-6 mx-auto mb-6 rounded-full w-fit bg-muted">
            <FileText className="w-12 h-12 text-muted-foreground" />
          </div>
          <h3 className="mb-2 text-2xl font-semibold">Document Not Found</h3>
          <p className="mb-6 text-muted-foreground">The document you're looking for doesn't exist or has been deleted.</p>
          <Button
            variant="outline"
            onClick={() => navigate("/documents")}
            className="gap-2 rounded-full"
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
      <div className="container flex flex-col items-center justify-center min-h-[70vh] mx-auto">
        <div className="p-8 text-center border shadow-inner rounded-xl bg-card/50">
          <div className="p-6 mx-auto mb-6 rounded-full w-fit bg-destructive/10">
            <FileText className="w-12 h-12 text-destructive" />
          </div>
          <h3 className="mb-2 text-2xl font-semibold">Error Loading Markdown</h3>
          <p className="mb-6 text-muted-foreground">There was a problem loading the markdown content.</p>
          <Button
            variant="outline"
            onClick={handleBackClick}
            className="gap-2 rounded-full"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Document Details
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container py-8 mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleBackClick}
            className="rounded-full hover:bg-primary/5"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{documentData.title}</h1>
              <Badge
                variant="outline"
                className="rounded-full px-3 py-0.5 font-medium text-xs bg-emerald-500/10 text-emerald-600 border-emerald-200"
              >
                Markdown
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Viewing markdown content
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePdfViewClick}
            className="flex items-center gap-1.5 rounded-full"
          >
            <FileText className="w-4 h-4" />
            <span className="hidden sm:inline">View</span> PDF
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleComparisonViewClick}
            className="flex items-center gap-1.5 rounded-full"
          >
            <LayoutPanelTop className="w-4 h-4" />
            <span className="hidden sm:inline">Side-by-side</span> View
          </Button>
          <Button
            size="sm"
            onClick={handleEditClick}
            className="flex items-center gap-1.5 rounded-full shadow-sm"
          >
            <Edit className="w-4 h-4" />
            Edit
          </Button>
        </div>
      </div>

      {/* Markdown Viewer */}
      <Card className="overflow-hidden border shadow-sm">
        <CardContent className="p-0 overflow-hidden">
          <div className="w-full h-[calc(100vh-180px)] border-t">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full h-full">
              <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/30">
                <TabsList className="h-9">
                  <TabsTrigger value="full" className="px-4 text-xs rounded-full">Full Document</TabsTrigger>
                  <TabsTrigger value="chunks" className="px-4 text-xs rounded-full">
                    Chunks
                    <span className="ml-1.5 px-1.5 py-0.5 text-[10px] rounded-full bg-primary/10">
                      {markdownData.chunks.length}
                    </span>
                  </TabsTrigger>
                </TabsList>
                <div className="text-xs text-muted-foreground">
                  {activeTab === "full" ? "Viewing complete document" : `Viewing chunks (${markdownData.chunks.length})`}
                </div>
              </div>

              <TabsContent value="full" className="p-0 m-0 h-[calc(100%-48px)]">
                <div className="h-full p-6 overflow-auto">
                  <MarkdownPreview content={markdownData.content} />
                </div>
              </TabsContent>

              <TabsContent value="chunks" className="p-0 m-0 h-[calc(100%-48px)]">
                <div className="h-full p-4 overflow-auto">
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