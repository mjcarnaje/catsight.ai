import MarkdownPreview from "@/components/markdown-preview";
import MDXEditorComponent from "@/components/markdown-editor";
import PDFViewer from "@/components/pdf-viewer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/api";
import { Document } from "@/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ChevronLeft, Edit, FileText, Loader2, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useToast } from "@/components/ui/use-toast";

export function EditDocumentPage() {
  const { id } = useParams();
  const { toast } = useToast();

  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("edit");
  const [markdown, setMarkdown] = useState("");
  const [isFullscreen, setIsFullscreen] = useState(false);

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

  // Loading skeleton
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="w-64 h-8" />
          <Skeleton className="w-24 h-10" />
        </div>
        <Skeleton className="w-full h-[calc(100vh-200px)] rounded-lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center text-destructive">
        <FileText className="w-12 h-12 mx-auto mb-4" />
        <h3 className="text-xl font-semibold">Error Loading Document</h3>
        <p className="mb-4">There was a problem loading this document.</p>
        <Button variant="outline" onClick={() => navigate("/documents")}>Back to Documents</Button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center text-muted-foreground">
        <FileText className="w-12 h-12 mx-auto mb-4" />
        <h3 className="text-xl font-semibold">Document Not Found</h3>
        <p className="mb-4">The document you're looking for doesn't exist or has been deleted.</p>
        <Button variant="outline" onClick={() => navigate("/documents")}>Back to Documents</Button>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${isFullscreen ? 'fixed inset-0 z-50 bg-background p-6' : ''}`}>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={handleBackClick}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-primary">{data.title}</h1>
              <span className="px-2 py-1 text-xs font-medium rounded-full bg-secondary text-secondary-foreground">
                Edit
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              Editing document content
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
            <Edit className="w-4 h-4" />
            <span className="hidden sm:inline">View</span> Comparison
          </Button>
          <Button
            onClick={() => handleUpdateMarkdown(markdown)}
            className="flex items-center gap-1"
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
      <Card className="overflow-hidden border-0 shadow-sm">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/30">
            <TabsList>
              <TabsTrigger value="edit" className="px-3 text-xs">Edit Markdown</TabsTrigger>
              <TabsTrigger value="preview" className="px-3 text-xs">Preview</TabsTrigger>
              <TabsTrigger value="comparison" className="px-3 text-xs">Side by Side</TabsTrigger>
            </TabsList>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsFullscreen(!isFullscreen)}
                className="px-2 text-xs h-7"
              >
                {isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
              </Button>
              <Button variant="ghost" size="sm" onClick={handleBackClick} className="flex items-center gap-1 px-2 text-xs h-7">
                <ChevronLeft className="w-3 h-3" />
                Back
              </Button>
            </div>
          </div>

          {/* Edit Tab */}
          <TabsContent value="edit" className="p-0 m-0">
            <div className="h-[calc(100vh-240px)]">
              <DocMarkdownEditor id={data.id.toString()} markdown={markdown} setMarkdown={setMarkdown} />
            </div>
          </TabsContent>

          {/* Preview Tab */}
          <TabsContent value="preview" className="p-0 m-0">
            <div className="h-[calc(100vh-240px)] p-6 overflow-auto">
              <MarkdownPreview content={markdown} />
            </div>
          </TabsContent>

          {/* Side-by-Side Tab */}
          <TabsContent value="comparison" className="p-0 m-0">
            <ResizablePanelGroup direction="horizontal" className="h-[calc(100vh-240px)]">
              <ResizablePanel defaultSize={50} minSize={30}>
                <div className="flex flex-col h-full border-r">
                  <div className="flex items-center px-4 py-2 border-b bg-muted/20">
                    <h3 className="text-xs font-medium">Editor</h3>
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <DocMarkdownEditor id={data.id.toString()} markdown={markdown} setMarkdown={setMarkdown} />
                  </div>
                </div>
              </ResizablePanel>

              <ResizableHandle withHandle />

              <ResizablePanel defaultSize={50} minSize={30}>
                <div className="flex flex-col h-full">
                  <div className="flex items-center px-4 py-2 border-b bg-muted/20">
                    <h3 className="text-xs font-medium">Preview</h3>
                  </div>
                  <div className="flex-1 p-6 overflow-auto">
                    <MarkdownPreview content={markdown} />
                  </div>
                </div>
              </ResizablePanel>
            </ResizablePanelGroup>
          </TabsContent>
        </Tabs>

        <CardContent className="p-3 border-t bg-muted/10">
          <div className="flex items-center justify-between">
            <div className="text-xs text-muted-foreground">
              {activeTab === "edit" ? "Editing markdown content" :
                activeTab === "preview" ? "Previewing rendered markdown" :
                  "Side-by-side editing and preview"}
            </div>
            <Button
              onClick={() => handleUpdateMarkdown(markdown)}
              variant="default"
              size="sm"
              disabled={updateMarkdown.isPending}
              className="h-8"
            >
              {updateMarkdown.isPending ? (
                <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
              ) : (
                <Save className="w-3.5 h-3.5 mr-2" />
              )}
              Save Document
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function DocPdfViewer({ id }: { id: string }) {
  const { isLoading, data: blobUrl } = useQuery({
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

  if (isLoading) {
    return <Skeleton className="w-full h-full rounded" />;
  }

  return <PDFViewer url={blobUrl!} />;
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
        <div className="w-8 h-8 border-4 rounded-full animate-spin border-primary border-t-transparent"></div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center w-full h-full text-destructive">
        <FileText className="w-12 h-12 mb-2 text-muted-foreground/50" />
        <p>Error loading markdown content</p>
      </div>
    );
  }

  return (
    <div className="h-full">
      <MDXEditorComponent markdown={markdown} onChange={setMarkdown} />
    </div>
  );
}
