import PDFViewer from "@/components/pdf-viewer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { Document } from "@/types";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ChevronLeft, Edit, FileText, FilePlus2, Grid3X3 } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";

export function DocumentPdfPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { isLoading: isDocLoading, data: documentData } = useQuery({
    queryKey: ["document", id],
    queryFn: () => api.get<Document>(`/documents/${id}`).then((res) => res.data),
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
  const handleMarkdownViewClick = () => navigate(`/documents/${id}/markdown`);
  const handleComparisonViewClick = () => navigate(`/documents/${id}/comparison`);

  if (isDocLoading) {
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
                PDF
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              Viewing original PDF document
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleMarkdownViewClick}
            className="flex items-center gap-1"
          >
            <FilePlus2 className="w-4 h-4" />
            <span className="hidden sm:inline">View</span> Markdown
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

      {/* PDF Viewer */}
      <Card className="overflow-hidden border-0 shadow-sm">
        <CardContent className="p-0 overflow-hidden">
          <div className="w-full h-[calc(100vh-200px)] bg-muted/40">
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
        </CardContent>
      </Card>
    </div>
  );
} 