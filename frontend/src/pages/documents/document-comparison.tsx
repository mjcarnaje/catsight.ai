import ChunkViewer from "@/components/chunk-viewer";
import MarkdownPreview from "@/components/markdown-preview";
import PDFViewer from "@/components/pdf-viewer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/api";
import { Document } from "@/types";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Edit, FileText, Grid3X3, LayoutPanelTop } from "lucide-react";
import { useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Badge } from "@/components/ui/badge";

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
      const res = await fetch(`/api/documents/${id}/raw`, {
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
          <h3 className="mb-2 text-2xl font-semibold">Error Loading Document</h3>
          <p className="mb-6 text-muted-foreground">There was a problem loading the document content.</p>
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
                className="rounded-full px-3 py-0.5 font-medium text-xs bg-purple-500/10 text-purple-600 border-purple-200"
              >
                Comparison
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Side-by-side comparison view
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
            onClick={handleMarkdownViewClick}
            className="flex items-center gap-1.5 rounded-full"
          >
            <Grid3X3 className="w-4 h-4" />
            <span className="hidden sm:inline">View</span> Markdown
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

      {/* Comparison Viewer */}
      <Card className="overflow-hidden border shadow-sm">
        <CardContent className="p-0 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/30">
            <div className="flex items-center gap-2">
              <LayoutPanelTop className="w-4 h-4 text-primary" />
              <h2 className="text-sm font-medium">Side-by-Side Comparison</h2>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBackClick}
              className="flex items-center gap-1.5 px-2.5 h-8 rounded-full"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to Details
            </Button>
          </div>

          <ResizablePanelGroup direction="horizontal" className="min-h-[calc(100vh-220px)]">
            <ResizablePanel defaultSize={50} minSize={30}>
              <div className="flex flex-col h-full border-r">
                <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/30">
                  <h3 className="text-sm font-medium">Original PDF</h3>
                </div>
                <div className="flex-1 overflow-hidden">
                  {isPdfLoading ? (
                    <div className="flex items-center justify-center w-full h-full">
                      <div className="relative w-12 h-12">
                        <div className="absolute w-12 h-12 rounded-full opacity-25 animate-ping bg-primary"></div>
                        <div className="w-12 h-12 border-4 rounded-full animate-spin border-primary border-t-transparent"></div>
                      </div>
                    </div>
                  ) : blobUrl ? (
                    <PDFViewer url={blobUrl} />
                  ) : (
                    <div className="flex flex-col items-center justify-center w-full h-full">
                      <div className="p-6 mx-auto mb-4 rounded-full w-fit bg-muted/50">
                        <FileText className="w-12 h-12 text-muted-foreground" />
                      </div>
                      <p className="text-muted-foreground">Unable to load PDF</p>
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
                        <TabsTrigger value="full" className="px-3 text-xs rounded-full">Full Document</TabsTrigger>
                        <TabsTrigger value="chunks" className="px-3 text-xs rounded-full">
                          Chunks
                          <span className="ml-1.5 px-1.5 py-0.5 text-[10px] rounded-full bg-primary/10">
                            {markdownData.chunks.length}
                          </span>
                        </TabsTrigger>
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