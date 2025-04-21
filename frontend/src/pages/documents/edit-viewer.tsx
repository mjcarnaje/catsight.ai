import MarkdownPreview from "@/components/markdown-preview";
import MDXEditorComponent from "@/components/markdown-editor";
import PDFViewer from "@/components/pdf-viewer";
import { Button } from "@/components/ui/button";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/api";
import { Document } from "@/types";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Edit } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

export function DocumentEditPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { isLoading, error, data } = useQuery({
    queryKey: ["document", id],
    queryFn: () => api.get<Document>(`/documents/${id}`).then((res) => res.data),
  });

  const handleEditClick = () => navigate(`/edit/${id}`);
  const handleBackClick = () => navigate("/");

  // Loading skeleton
  if (isLoading) {
    return (
      <div className="container p-4 mx-auto">
        <Skeleton className="w-3/4 h-8 mb-6" />
        <div className="flex space-x-4">
          <Skeleton className="h-[600px] w-1/2 rounded-lg" />
          <Skeleton className="h-[600px] w-1/2 rounded-lg" />
        </div>
      </div>
    );
  }

  if (error) {
    return <div className="text-destructive">Error loading document.</div>;
  }

  if (!data) {
    return <div className="text-muted-foreground">Document not found.</div>;
  }

  return (
    <div className="container flex flex-col h-screen p-4 mx-auto space-y-4">
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

      <ResizablePanelGroup direction="horizontal" className="flex-1 overflow-hidden border rounded-lg shadow">
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
  const [activeTab, setActiveTab] = useState("edit");
  const [markdown, setMarkdown] = useState("")

  const { isLoading, error, data } = useQuery({
    queryKey: ["doc-md", id],
    queryFn: () => api.get<{ content: string; chunks: string[] }>(`/documents/${id}/markdown`).then((r) => r.data),
  });

  useEffect(() => {
    if (data) {
      setMarkdown(data.content);
    }
  }, [data]);

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
          <TabsTrigger value="edit">Edit</TabsTrigger>
          <TabsTrigger value="preview">Preview</TabsTrigger>
        </TabsList>
        <TabsContent value="edit" className="h-full p-4 overflow-auto">
          <MDXEditorComponent markdown={markdown} onChange={setMarkdown} />
        </TabsContent>
        <TabsContent value="preview" className="h-full p-4 overflow-auto">
          <MarkdownPreview content={markdown} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
