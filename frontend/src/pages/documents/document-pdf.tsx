import PDFViewer from "@/components/pdf-viewer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { Document } from "@/types";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Edit, FileText, FilePlus2, Grid3X3, LayoutPanelTop } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { Badge } from "@/components/ui/badge";

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
  const handleMarkdownViewClick = () => navigate(`/documents/${id}/markdown`);
  const handleComparisonViewClick = () => navigate(`/documents/${id}/comparison`);

  if (isDocLoading) {
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
                className="rounded-full px-3 py-0.5 font-medium text-xs bg-blue-500/10 text-blue-600 border-blue-200"
              >
                PDF
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Viewing original PDF document
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleMarkdownViewClick}
            className="flex items-center gap-1.5 rounded-full"
          >
            <FilePlus2 className="w-4 h-4" />
            <span className="hidden sm:inline">View</span> Markdown
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

      {/* PDF Viewer */}
      <Card className="overflow-hidden border shadow-sm">
        <CardContent className="p-0 overflow-hidden">
          <div className="w-full h-[calc(100vh-180px)] bg-muted/20">
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
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleBackClick}
                  className="mt-4 rounded-full"
                >
                  Back to Document
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 