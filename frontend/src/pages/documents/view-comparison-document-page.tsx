import ChunkViewer from "@/components/chunk-viewer";
import MarkdownPreview from "@/components/markdown-preview";
import PDFViewer from "@/components/pdf-viewer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api, documentsApi } from "@/lib/api";
import { getStatusInfo } from "@/lib/document-status";
import { Document } from "@/types";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Calendar, Edit, File, FileText, LayoutPanelLeft, Pencil, User } from "lucide-react";
import { useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { formatDistance } from "date-fns";

export function ViewComparisonDocumentPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("details");

  const { isLoading, error, data } = useQuery({
    queryKey: ["document", id],
    queryFn: () => api.get<Document>(`/documents/${id}`).then((res) => res.data),
  });

  const handleEditClick = () => navigate(`/documents/${id}/edit`);
  const handleBackClick = () => navigate("/documents");

  // Loading skeleton
  if (isLoading) {
    return (
      <div className="container p-4 mx-auto">
        <Skeleton className="w-3/4 h-8 mb-6" />
        <Skeleton className="w-full h-48 mb-6 rounded-lg" />
        <Skeleton className="w-full h-[500px] rounded-lg" />
      </div>
    );
  }

  if (error) {
    return <div className="text-destructive">Error loading document.</div>;
  }

  if (!data) {
    return <div className="text-muted-foreground">Document not found.</div>;
  }

  const statusInfo = getStatusInfo(data.status);

  return (
    <div className="container flex flex-col h-screen mx-auto space-y-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={handleBackClick}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-3xl font-bold text-primary">{data.title}</h1>
        </div>
        <Button onClick={handleEditClick} className="flex items-center gap-2">
          <Edit className="w-5 h-5" /> Edit
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="pdf">PDF View</TabsTrigger>
          <TabsTrigger value="markdown">Markdown</TabsTrigger>
          <TabsTrigger value="comparison">Comparison</TabsTrigger>
        </TabsList>

        {/* Document Details Tab */}
        <TabsContent value="details" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">{data.title}</CardTitle>
              <CardDescription>Document details and information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-4">
                  <div>
                    <h3 className="mb-2 text-sm font-medium text-muted-foreground">File Information</h3>
                    <div className="grid grid-cols-2 gap-2 p-4 border rounded-lg">
                      <div className="flex items-center gap-2">
                        <File className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm font-medium">Filename:</span>
                      </div>
                      <span className="text-sm">{data.file_name}</span>

                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm font-medium">File Type:</span>
                      </div>
                      <span className="text-sm">{data.file_type}</span>

                      <div className="flex items-center gap-2">
                        <LayoutPanelLeft className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm font-medium">Chunks:</span>
                      </div>
                      <span className="text-sm">{data.no_of_chunks}</span>
                    </div>
                  </div>

                  <div>
                    <h3 className="mb-2 text-sm font-medium text-muted-foreground">Status Information</h3>
                    <div className="p-4 border rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <div className={`w-3 h-3 rounded-full ${statusInfo.color.bg}`}></div>
                        <span className="text-sm font-medium">{statusInfo.label}</span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {data.status === "completed"
                          ? "Document has been fully processed and is ready for use."
                          : data.status === "pending"
                            ? "Document is waiting to be processed."
                            : `Document is currently being processed (${statusInfo.label}).`
                        }
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <h3 className="mb-2 text-sm font-medium text-muted-foreground">Metadata</h3>
                    <div className="grid grid-cols-2 gap-2 p-4 border rounded-lg">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm font-medium">Created:</span>
                      </div>
                      <span className="text-sm">{formatDistance(new Date(data.created_at), new Date(), { addSuffix: true })}</span>

                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm font-medium">Updated:</span>
                      </div>
                      <span className="text-sm">{formatDistance(new Date(data.updated_at), new Date(), { addSuffix: true })}</span>

                      {data.uploaded_by && (
                        <>
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4 text-muted-foreground" />
                            <span className="text-sm font-medium">Uploaded by:</span>
                          </div>
                          <span className="text-sm">{data.uploaded_by.name || data.uploaded_by.email}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {data.description && (
                    <div>
                      <h3 className="mb-2 text-sm font-medium text-muted-foreground">Description</h3>
                      <div className="p-4 border rounded-lg">
                        <p className="text-sm whitespace-pre-wrap">{data.description}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-between pt-4 border-t">
                <Button variant="outline" onClick={handleBackClick}>
                  <ArrowLeft className="w-4 h-4 mr-2" /> Back to Documents
                </Button>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setActiveTab("pdf")}>
                    View PDF
                  </Button>
                  <Button variant="outline" onClick={() => setActiveTab("markdown")}>
                    View Markdown
                  </Button>
                  <Button onClick={() => setActiveTab("comparison")}>
                    View Comparison
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* PDF View Tab */}
        <TabsContent value="pdf" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>PDF View</span>
                <Button variant="outline" size="sm" onClick={() => setActiveTab("details")}>
                  Back to Details
                </Button>
              </CardTitle>
              <CardDescription>Original PDF document</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[600px] border rounded-lg overflow-hidden">
                <DocPdfViewer id={data.id.toString()} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Markdown View Tab */}
        <TabsContent value="markdown" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Markdown View</span>
                <Button variant="outline" size="sm" onClick={() => setActiveTab("details")}>
                  Back to Details
                </Button>
              </CardTitle>
              <CardDescription>Extracted markdown content</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[600px] border rounded-lg overflow-hidden">
                <DocMarkdownViewer id={data.id.toString()} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Comparison View Tab */}
        <TabsContent value="comparison" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>PDF & Markdown Comparison</span>
                <Button variant="outline" size="sm" onClick={() => setActiveTab("details")}>
                  Back to Details
                </Button>
              </CardTitle>
              <CardDescription>Side-by-side comparison of original PDF and extracted markdown</CardDescription>
            </CardHeader>
            <CardContent>
              <ResizablePanelGroup direction="horizontal" className="h-[600px] border rounded-lg">
                <ResizablePanel defaultSize={50} minSize={30}>
                  <div className="flex flex-col h-full bg-white">
                    <div className="p-3 font-semibold border-b">Original PDF</div>
                    <div className="flex-1 p-1 overflow-auto">
                      <DocPdfViewer id={data.id.toString()} />
                    </div>
                  </div>
                </ResizablePanel>

                <ResizableHandle withHandle />

                <ResizablePanel defaultSize={50} minSize={30}>
                  <div className="flex flex-col h-full bg-white">
                    <div className="p-3 font-semibold border-b">Markdown Preview</div>
                    <div className="flex-1 p-4 overflow-auto">
                      <DocMarkdownViewer id={data.id.toString()} />
                    </div>
                  </div>
                </ResizablePanel>
              </ResizablePanelGroup>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
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


export function DocMarkdownViewer({ id }: { id: string }) {
  const [searchParams] = useSearchParams();
  const chunk_index = searchParams.get("chunk_index");
  const highlight = searchParams.get("highlight");

  const [activeTab, setActiveTab] = useState(chunk_index ? "chunks" : "full");
  const { isLoading, error, data } = useQuery({
    queryKey: ["doc-md", id],
    queryFn: () => api.get<{ content: string; chunks: string[] }>(`/documents/${id}/markdown`).then((r) => r.data),
  });

  if (isLoading) {
    return <Skeleton className="w-full h-full" />;
  }
  if (error || !data) {
    return <div className="text-destructive">Error loading markdown.</div>;
  }

  return (
    <div className="flex flex-col h-full">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList>
          <TabsTrigger value="chunks">Chunks</TabsTrigger>
          <TabsTrigger value="full">Full</TabsTrigger>
        </TabsList>
        <TabsContent value="full" className="h-full p-4 overflow-auto">
          <MarkdownPreview content={data.content} />
        </TabsContent>
        <TabsContent value="chunks" className="h-full p-4 overflow-auto">
          <ChunkViewer chunks={data.chunks} chunk_index={chunk_index} highlight={highlight} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
