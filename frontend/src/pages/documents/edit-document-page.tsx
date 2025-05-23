import MarkdownPreview from "@/components/markdown-preview";
import EnhancedMarkdownEditor from "../../components/enhanced-markdown-editor";
import PDFViewer from "@/components/pdf-viewer";
import PDFViewerContentOnly from "@/components/pdf-viewer-content-only";
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
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ChevronLeft, FileText, LayoutPanelTop, Loader2, Maximize2, Minimize2, Save, SplitSquareVertical, Eye, FileCode, PanelLeftClose, PanelRightClose, Expand } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useToast } from "@/components/ui/use-toast";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function EditDocumentPage() {
  const { id } = useParams();
  const { toast } = useToast();

  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [markdown, setMarkdown] = useState("");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [viewMode, setViewMode] = useState<"editor-only" | "side-by-side">("editor-only");
  const [activeTab, setActiveTab] = useState<"editor" | "preview">("editor");

  // Collapse states for the panels
  const [isPdfCollapsed, setIsPdfCollapsed] = useState(false);
  const [isEditorCollapsed, setIsEditorCollapsed] = useState(false);

  const { isLoading, error, data } = useQuery({
    queryKey: ["document", id],
    queryFn: () => api.get<Document>(`/documents/${id}`).then((res) => res.data),
  });

  const updateMarkdown = useMutation({
    mutationFn: (markdown: string) => api.put(`/documents/${id}/update`, { markdown }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["document", id] });
      toast({
        title: "Document updated",
        description: "Document updated successfully",
      });
      navigate(`/documents/${id}`);
    },
    onError: () => {
      toast({
        title: "Error updating document",
        description: "Please try again",
      });
    },
  });

  const handleBackClick = () => navigate(`/documents/${id}`);
  const handlePdfViewClick = () => navigate(`/documents/${id}/pdf`);
  const handleComparisonViewClick = () => navigate(`/documents/${id}/comparison`);

  const handleUpdateMarkdown = (markdown: string) => {
    updateMarkdown.mutate(markdown);
  };

  const toggleViewMode = () => {
    setViewMode(viewMode === "editor-only" ? "side-by-side" : "editor-only");
    // Reset collapse states when switching view modes
    setIsPdfCollapsed(false);
    setIsEditorCollapsed(false);
  };

  // Determine panel sizes based on collapse states
  const getPdfPanelSize = () => {
    if (isPdfCollapsed) return 0;
    if (isEditorCollapsed) return 100;
    return 40;
  };

  const getEditorPanelSize = () => {
    if (isEditorCollapsed) return 0;
    if (isPdfCollapsed) return 100;
    return 60;
  };

  // Loading skeleton
  if (isLoading) {
    return (
      <div className="container z-10 py-8 mx-auto space-y-6">
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

  if (error) {
    return (
      <div className="container z-10 flex flex-col items-center justify-center min-h-[70vh] mx-auto">
        <div className="p-8 text-center border shadow-inner rounded-xl bg-card/50">
          <div className="p-6 mx-auto mb-6 rounded-full w-fit bg-destructive/10">
            <FileText className="w-12 h-12 text-destructive" />
          </div>
          <h3 className="mb-2 text-2xl font-semibold">Error Loading Document</h3>
          <p className="mb-6 text-muted-foreground">There was a problem loading this document.</p>
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

  if (!data) {
    return (
      <div className="container z-10 flex flex-col items-center justify-center min-h-[70vh] mx-auto">
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

  return (
    <div className={`container z-10 mx-auto py-8 space-y-6 ${isFullscreen ? 'fixed inset-0 z-50 bg-background p-6' : ''}`}>
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
              <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{data.title}</h1>
              <Badge
                variant="outline"
                className="rounded-full px-3 py-0.5 font-medium text-xs bg-amber-500/10 text-amber-600 border-amber-200"
              >
                Editing
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Editing document content
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={toggleViewMode}
                  className="flex items-center gap-1.5 rounded-full"
                >
                  {viewMode === "editor-only" ? <SplitSquareVertical className="w-4 h-4" /> : <FileCode className="w-4 h-4" />}
                  {viewMode === "editor-only" ? "Side-by-side" : "Editor Only"}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {viewMode === "editor-only" ? "Switch to side-by-side view" : "Switch to editor only"}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
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
            onClick={() => handleUpdateMarkdown(markdown)}
            className="flex items-center gap-1.5 rounded-full shadow-sm"
            size="sm"
            disabled={updateMarkdown.isPending}
          >
            {updateMarkdown.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Save Changes
          </Button>
        </div>
      </div>

      {/* Edit Interface */}
      <Card className="overflow-hidden border shadow-sm">
        <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/30">
          <h3 className="text-sm font-medium">
            {viewMode === "editor-only" ? "Markdown Editor" : "Side-by-side Editor"}
          </h3>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="flex items-center gap-1.5 px-2.5 text-xs h-8 rounded-full"
            >
              {isFullscreen ? (
                <>
                  <Minimize2 className="w-3.5 h-3.5" />
                  Exit Fullscreen
                </>
              ) : (
                <>
                  <Maximize2 className="w-3.5 h-3.5" />
                  Fullscreen
                </>
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBackClick}
              className="flex items-center gap-1.5 px-2.5 text-xs h-8 rounded-full"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              Back
            </Button>
          </div>
        </div>

        <div className="h-[calc(100vh-240px)] overflow-hidden">
          {viewMode === "editor-only" ? (
            <DocMarkdownEditor id={data.id.toString()} markdown={markdown} setMarkdown={setMarkdown} />
          ) : (
            <ResizablePanelGroup direction="horizontal" className="h-full">
              {/* PDF Panel */}
              <ResizablePanel defaultSize={getPdfPanelSize()} minSize={0} collapsible={true} collapsedSize={0}>
                <div className="flex flex-col h-full border-r">
                  <div className="flex items-center justify-between p-2 border-b bg-gradient-to-r from-blue-50/50 to-blue-50/20">
                    <h3 className="flex items-center gap-2 text-xs font-medium">
                      <Eye className="w-3.5 h-3.5 text-blue-500/70" />
                      Original PDF
                    </h3>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-6 h-6 p-0 rounded-full"
                            onClick={() => setIsPdfCollapsed(!isPdfCollapsed)}
                          >
                            {isPdfCollapsed ?
                              <Expand className="h-3.5 w-3.5 text-muted-foreground" /> :
                              <PanelLeftClose className="h-3.5 w-3.5 text-muted-foreground" />
                            }
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" align="end">
                          {isPdfCollapsed ? "Expand panel" : "Collapse panel"}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <div className="flex-1 overflow-auto">
                    {!isPdfCollapsed && <DocPdfViewer id={data.id.toString()} />}
                  </div>
                </div>
              </ResizablePanel>

              {!isPdfCollapsed && !isEditorCollapsed && (
                <ResizableHandle withHandle className="transition-colors bg-muted/30 hover:bg-muted/50" />
              )}

              {/* Markdown Editor Panel */}
              <ResizablePanel defaultSize={getEditorPanelSize()} minSize={0} collapsible={true} collapsedSize={0}>
                <div className="flex flex-col h-full">
                  <div className="flex items-center justify-between p-2 border-b bg-gradient-to-r from-amber-50/50 to-amber-50/20">
                    <h3 className="flex items-center gap-2 text-xs font-medium">
                      <FileCode className="w-3.5 h-3.5 text-amber-500/70" />
                      Markdown Editor
                    </h3>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-6 h-6 p-0 rounded-full"
                            onClick={() => setIsEditorCollapsed(!isEditorCollapsed)}
                          >
                            {isEditorCollapsed ?
                              <Expand className="h-3.5 w-3.5 text-muted-foreground" /> :
                              <PanelLeftClose className="h-3.5 w-3.5 text-muted-foreground" />
                            }
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" align="end">
                          {isEditorCollapsed ? "Expand panel" : "Collapse panel"}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <div className="flex-1 overflow-auto">
                    {!isEditorCollapsed && (
                      <EnhancedMarkdownEditor
                        markdown={markdown}
                        onChange={setMarkdown}
                        height={800}
                      />
                    )}
                  </div>
                </div>
              </ResizablePanel>
            </ResizablePanelGroup>
          )}
        </div>

        <CardContent className="flex items-center justify-between p-3 border-t bg-muted/10">
          <div className="text-xs text-muted-foreground">
            {viewMode === "editor-only" ? "Editing markdown content" : "Side-by-side editing with PDF reference"}
          </div>
          <Button
            onClick={() => handleUpdateMarkdown(markdown)}
            variant="default"
            size="sm"
            disabled={updateMarkdown.isPending}
            className="h-8 gap-1.5 rounded-full shadow-sm"
          >
            {updateMarkdown.isPending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            Save Document
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export function DocPdfViewer({ id }: { id: string }) {
  const { isLoading, data: blobUrl } = useQuery({
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center w-full h-full">
        <div className="relative w-12 h-12">
          <div className="absolute w-12 h-12 rounded-full opacity-25 animate-ping bg-primary"></div>
          <div className="w-12 h-12 border-4 rounded-full animate-spin border-primary border-t-transparent"></div>
        </div>
      </div>
    );
  }

  return <PDFViewerContentOnly url={blobUrl!} />;
}

export function DocMarkdownEditor({ id, markdown, setMarkdown }: { id: string; markdown: string; setMarkdown: (markdown: string) => void }) {
  const { isLoading, error, data } = useQuery({
    queryKey: ["doc-md", id],
    queryFn: () => api.get<{ content: string; chunks: string[] }>(`/documents/${id}/markdown`).then((r) => r.data),
  });

  useEffect(() => {
    if (data) {
      setMarkdown(data.content);
    }
  }, [data, setMarkdown]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center w-full h-full">
        <div className="relative w-12 h-12">
          <div className="absolute w-12 h-12 rounded-full opacity-25 animate-ping bg-primary"></div>
          <div className="w-12 h-12 border-4 rounded-full animate-spin border-primary border-t-transparent"></div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center w-full h-full">
        <div className="p-4 mx-auto mb-4 rounded-full w-fit bg-destructive/10">
          <FileText className="w-8 h-8 text-destructive" />
        </div>
        <p className="text-sm text-destructive">Error loading markdown content</p>
      </div>
    );
  }

  return (
    <div className="h-full">
      <EnhancedMarkdownEditor markdown={markdown} onChange={setMarkdown} height={800} />
    </div>
  );
}
