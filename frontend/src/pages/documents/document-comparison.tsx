import ChunkViewer from "@/components/chunk-viewer";
import MarkdownPreview from "@/components/markdown-preview";
import PDFViewer from "@/components/pdf-viewer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/api";
import { Document } from "@/types";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ChevronLeft, Edit, FileText, Grid3X3 } from "lucide-react";
import { useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";

export function DocumentComparisonPage() {
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

  const { isLoading: isPdfLoading, data: blobUrl } = useQuery({
    queryKey: ["pdf", id],
    queryFn: async () => {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/documents/${id}/raw`, {
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

  if (isDocLoading || isMarkdownLoading || isPdfLoading) {
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
        <h3 className="text-xl font-semibold">Error Loading Document</h3>
        <p className="mb-4">There was a problem loading the document content.</p>
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
                Comparison
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              Side-by-side comparison view
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
            onClick={handleMarkdownViewClick}
            className="flex items-center gap-1"
          >
            <Grid3X3 className="w-4 h-4" />
            <span className="hidden sm:inline">View</span> Markdown
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

      {/* Comparison Viewer */}
      <Card className="overflow-hidden border-0 shadow-sm">
        <CardHeader className="bg-muted/50 py-2 px-4 flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <Grid3X3 className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-medium">Side-by-Side Comparison</h2>
          </div>
          <Button variant="ghost" size="sm" onClick={handleBackClick} className="flex items-center gap-1 h-8">
            <ChevronLeft className="w-4 h-4" />
            Back to Details
          </Button>
        </CardHeader>
        <CardContent className="p-0 overflow-hidden">
          <ResizablePanelGroup direction="horizontal" className="min-h-[calc(100vh-220px)]">
            <ResizablePanel defaultSize={50} minSize={30}>
              <div className="flex flex-col h-full border-r">
                <div className="px-4 py-2 border-b bg-muted/30 flex items-center justify-between">
                  <h3 className="text-sm font-medium">Original PDF</h3>
                </div>
                <div className="flex-1 overflow-hidden">
                  {isPdfLoading ? (
                    <div className="flex items-center justify-center w-full h-full">
                      <div className="w-8 h-8 border-4 rounded-full animate-spin border-primary border-t-transparent"></div>
                    </div>
                  ) : blobUrl ? (
                    <PDFViewer url={blobUrl} />
                  ) : (
                    <div className="flex flex-col items-center justify-center w-full h-full">
                      <FileText className="w-12 h-12 text-muted-foreground/50" />
                      <p className="mt-2 text-muted-foreground">Unable to load PDF</p>
                    </div>
                  )}
                </div>
              </div>
            </ResizablePanel>

            <ResizableHandle withHandle />

            <ResizablePanel defaultSize={50} minSize={30}>
              <div className="flex flex-col h-full">
                <div className="px-4 py-2 border-b bg-muted/30">
                  <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <div className="flex items-center justify-between">
                      <TabsList className="h-8">
                        <TabsTrigger value="full" className="text-xs px-3">Full Document</TabsTrigger>
                        <TabsTrigger value="chunks" className="text-xs px-3">Chunks ({markdownData.chunks.length})</TabsTrigger>
                      </TabsList>
                      <span className="text-xs text-muted-foreground">
                        {activeTab === "full" ? "Viewing complete document" : `Viewing chunks (${markdownData.chunks.length})`}
                      </span>
                    </div>
                  </Tabs>
                </div>

                <div className="flex-1 overflow-auto">
                  {activeTab === "full" ? (
                    <div className="p-6">
                      <MarkdownPreview content={markdownData.content} />
                    </div>
                  ) : (
                    <div className="p-4">
                      <ChunkViewer
                        chunks={markdownData.chunks}
                        chunk_index={chunk_index}
                        highlight={highlight}
                      />
                    </div>
                  )}
                </div>
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>
        </CardContent>
      </Card>
    </div>
  );
} 