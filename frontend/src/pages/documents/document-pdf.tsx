import PDFViewer from "@/components/pdf-viewer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { Document } from "@/types";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Edit,
  FileText,
  FileCode,
  SplitSquareVertical,
  Loader2,
  Download,
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function DocumentPdfPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { isLoading: isDocLoading, data: documentData } = useQuery({
    queryKey: ["document", id],
    queryFn: () =>
      api.get<Document>(`/documents/${id}`).then((res) => res.data),
  });

  const { isLoading: isPdfLoading, data: blobUrl } = useQuery({
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

  const handleBackClick = () => navigate(`/documents/${id}`);
  const handleEditClick = () => navigate(`/documents/${id}/edit`);
  const handleMarkdownViewClick = () => navigate(`/documents/${id}/markdown`);
  const handleComparisonViewClick = () => navigate(`/documents/${id}/comparison`);
  const handleDownload = () => {
    if (blobUrl) {
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = documentData?.file_name || "document.pdf";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  if (isDocLoading) {
    return (
      <div className="container max-w-6xl py-10 mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Skeleton className="w-10 h-10 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="w-48 h-8" />
              <Skeleton className="w-32 h-5" />
            </div>
          </div>
          <div className="flex gap-3">
            <Skeleton className="h-10 rounded-full w-28" />
            <Skeleton className="h-10 rounded-full w-28" />
          </div>
        </div>
        <Skeleton className="w-full h-[calc(100vh-180px)] rounded-xl shadow-sm" />
      </div>
    );
  }

  if (!documentData) {
    return (
      <div className="container flex flex-col items-center justify-center min-h-[70vh] mx-auto">
        <div className="max-w-md p-8 text-center border shadow-lg rounded-xl bg-gradient-to-b from-white to-muted/20">
          <div className="flex items-center justify-center w-16 h-16 mx-auto mb-6 rounded-full bg-muted/30 backdrop-blur-sm">
            <FileText className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="mb-3 text-xl font-medium">Document Not Found</h3>
          <p className="mb-6 text-muted-foreground">
            The document you're looking for doesn't exist or has been deleted.
          </p>
          <Button
            onClick={() => navigate("/documents")}
            className="gap-2 px-6 rounded-full shadow-sm"
            size="lg"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Documents
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container max-w-6xl py-10 mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleBackClick}
            className="rounded-full hover:bg-muted/50"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
                {documentData.title}
              </h1>
              <Badge
                variant="outline"
                className="px-3 py-1 font-medium text-blue-600 border-blue-200 rounded-full shadow-sm bg-blue-500/10"
              >
                PDF
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Viewing original PDF document
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleDownload}
                  className="rounded-full shadow-sm"
                  disabled={!blobUrl}
                >
                  <Download className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Download PDF</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <Button
            variant="outline"
            onClick={handleMarkdownViewClick}
            className="gap-2 px-4 rounded-full"
          >
            <FileCode className="w-4 h-4" />
            <span className="hidden sm:inline">View</span> Markdown
          </Button>

          <Button
            variant="outline"
            onClick={handleComparisonViewClick}
            className="gap-2 px-4 rounded-full"
          >
            <SplitSquareVertical className="w-4 h-4" />
            <span className="hidden sm:inline">Side-by-side</span> View
          </Button>

          <Button
            onClick={handleEditClick}
            className="gap-2 px-5 rounded-full shadow-sm"
          >
            <Edit className="w-4 h-4" />
            Edit
          </Button>
        </div>
      </div>

      {/* PDF Viewer */}
      <Card className="overflow-hidden border shadow-md rounded-xl">
        <CardContent className="p-0 overflow-hidden">
          <div className="w-full h-[calc(100vh-180px)] bg-gradient-to-b from-muted/5 to-muted/20">
            {isPdfLoading ? (
              <div className="flex flex-col items-center justify-center w-full h-full gap-3">
                <Loader2 className="w-12 h-12 animate-spin text-primary/70" />
                <p className="text-sm text-muted-foreground">Loading PDF document...</p>
              </div>
            ) : blobUrl ? (
              <PDFViewer url={blobUrl} />
            ) : (
              <div className="flex flex-col items-center justify-center w-full h-full">
                <div className="flex items-center justify-center w-16 h-16 mb-4 rounded-full bg-muted/30 backdrop-blur-sm">
                  <FileText className="w-8 h-8 text-muted-foreground" />
                </div>
                <p className="mb-2 text-muted-foreground">Unable to load PDF</p>
                <Button
                  variant="outline"
                  onClick={handleBackClick}
                  className="gap-2 px-4 mt-4 rounded-full shadow-sm"
                >
                  <ArrowLeft className="w-4 h-4" />
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
