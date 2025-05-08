import ChunkViewer from "@/components/chunk-viewer";
import MarkdownPreview from "@/components/markdown-preview";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/api";
import { Document } from "@/types";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ChevronLeft, Edit, FileText, Grid3X3 } from "lucide-react";
import { useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";

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
      <div className="space-y-6">
        <Skeleton className="w-3/4 h-8" />
        <Skeleton className="w-full h-[calc(100vh-200px)] rounded-lg" />
      </div>
    );
  }

  if (!documentData) {
    return (
      <div className="text-center text-muted-foreground">
        <FileText className="w-12 h-12 mx-auto mb-4" />
        <h3 className="text-xl font-semibold">Document Not Found</h3>
        <p className="mb-4">The document you're looking for doesn't exist or has been deleted.</p>
        <Button variant="outline" onClick={() => navigate("/documents")}>Back to Documents</Button>
      </div>
    );
  }

  if (markdownError || !markdownData) {
    return (
      <div className="text-center text-destructive">
        <FileText className="w-12 h-12 mx-auto mb-4" />
        <h3 className="text-xl font-semibold">Error Loading Markdown</h3>
        <p className="mb-4">There was a problem loading the markdown content.</p>
        <Button variant="outline" onClick={handleBackClick}>Back to Document Details</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={handleBackClick}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-primary">{documentData.title}</h1>
              <span className="px-2 py-1 text-xs font-medium rounded-full bg-secondary text-secondary-foreground">
                Markdown
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              Viewing markdown content
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePdfViewClick}
            className="flex items-center gap-1"
          >
            <FileText className="w-4 h-4" />
            <span className="hidden sm:inline">View</span> PDF
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleComparisonViewClick}
            className="flex items-center gap-1"
          >
            <Grid3X3 className="w-4 h-4" />
            <span className="hidden sm:inline">View</span> Comparison
          </Button>
          <Button
            size="sm"
            onClick={handleEditClick}
            className="flex items-center gap-1"
          >
            <Edit className="w-4 h-4" />
            Edit
          </Button>
        </div>
      </div>

      {/* Markdown Viewer */}
      <Card className="overflow-hidden border-0 shadow-sm">
        <CardContent className="p-0 overflow-hidden">
          <div className="w-full h-[calc(100vh-200px)] border-t">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full h-full">
              <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/30">
                <TabsList>
                  <TabsTrigger value="full" className="text-xs">Full Document</TabsTrigger>
                  <TabsTrigger value="chunks" className="text-xs">Chunks ({markdownData.chunks.length})</TabsTrigger>
                </TabsList>
                <div className="text-xs text-muted-foreground">
                  {activeTab === "full" ? "Viewing complete document" : `Viewing chunks (${markdownData.chunks.length})`}
                </div>
              </div>

              <TabsContent value="full" className="p-0 m-0 h-[calc(100%-48px)]">
                <div className="h-full p-6 overflow-auto bg-white">
                  <MarkdownPreview content={markdownData.content} />
                </div>
              </TabsContent>

              <TabsContent value="chunks" className="p-0 m-0 h-[calc(100%-48px)]">
                <div className="h-full p-4 overflow-auto bg-white">
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