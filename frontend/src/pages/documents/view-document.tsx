import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { getStatusInfo } from "@/lib/document-status";
import { Document } from "@/types";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ArrowLeft, Calendar, Edit, Eye, FileText, FilePlus2, Grid3X3, User } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";

export function DocumentViewPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { isLoading, error, data } = useQuery({
    queryKey: ["document", id],
    queryFn: () => api.get<Document>(`/documents/${id}`).then((res) => res.data),
  });

  const handleEditClick = () => navigate(`/documents/${id}/edit`);
  const handlePdfViewClick = () => navigate(`/documents/${id}/pdf`);
  const handleMarkdownViewClick = () => navigate(`/documents/${id}/markdown`);
  const handleComparisonViewClick = () => navigate(`/documents/${id}/comparison`);
  const handleBackClick = () => navigate("/documents");

  // Loading skeleton
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="w-3/4 h-8" />
          <Skeleton className="w-24 h-10" />
        </div>
        <Skeleton className="w-full h-64 rounded-lg" />
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <Skeleton className="w-full h-32 rounded-lg" />
          <Skeleton className="w-full h-32 rounded-lg" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-center text-destructive">
        <FileText className="w-12 h-12 mx-auto mb-4" />
        <h3 className="text-xl font-semibold">Error Loading Document</h3>
        <p className="mb-4">There was a problem loading this document.</p>
        <Button variant="outline" onClick={handleBackClick}>Back to Documents</Button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        <FileText className="w-12 h-12 mx-auto mb-4" />
        <h3 className="text-xl font-semibold">Document Not Found</h3>
        <p className="mb-4">The document you're looking for doesn't exist or has been deleted.</p>
        <Button variant="outline" onClick={handleBackClick}>Back to Documents</Button>
      </div>
    );
  }

  const statusInfo = getStatusInfo(data.status);
  const formattedCreatedDate = format(new Date(data.created_at), "PPP");
  const formattedUpdatedDate = format(new Date(data.updated_at), "PPP");

  return (
    <div className="space-y-6">
      {/* Document Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={handleBackClick} className="flex-shrink-0">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-primary">{data.title}</h1>
            <div className="flex items-center gap-2 mt-1">
              <div className={`w-2 h-2 rounded-full ${statusInfo.color.bg}`}></div>
              <span className="text-sm text-muted-foreground">{statusInfo.label}</span>
            </div>
          </div>
        </div>
        <Button onClick={handleEditClick} className="flex items-center gap-2 sm:self-start">
          <Edit className="w-4 h-4" />
          Edit Document
        </Button>
      </div>

      {/* Document Info Card */}
      <Card className="overflow-hidden border-0 shadow-sm bg-card/50">
        <CardHeader className="pb-4 bg-muted/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-semibold">{data.file_name}</h2>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            {data.description || "No description provided for this document."}
          </p>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid gap-6 md:grid-cols-3">
            {/* File Information */}
            <div className="space-y-4 md:col-span-2">
              <h3 className="font-medium text-muted-foreground">Document Information</h3>
              <div className="grid grid-cols-2 gap-y-4">
                <div className="text-sm font-medium">File Type</div>
                <div className="text-sm">{data.file_type}</div>

                <div className="text-sm font-medium">Created</div>
                <div className="flex items-center gap-1 text-sm">
                  <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                  {formattedCreatedDate}
                </div>

                <div className="text-sm font-medium">Updated</div>
                <div className="flex items-center gap-1 text-sm">
                  <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                  {formattedUpdatedDate}
                </div>

                <div className="text-sm font-medium">Chunks</div>
                <div className="text-sm">{data.no_of_chunks}</div>

                {data.uploaded_by && (
                  <>
                    <div className="text-sm font-medium">Uploaded By</div>
                    <div className="flex items-center gap-1 text-sm">
                      <User className="w-3.5 h-3.5 text-muted-foreground" />
                      {data.uploaded_by.name || data.uploaded_by.email}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Document Preview */}
            <div className="space-y-4">
              <h3 className="font-medium text-muted-foreground">Document Preview</h3>
              <div className="overflow-hidden border rounded-lg aspect-[210/297] h-72 bg-muted/30 flex items-center justify-center">
                <FileText className="w-12 h-12 text-muted-foreground/40" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Document Actions */}
      <Card className="overflow-hidden border-0 shadow-sm">
        <CardHeader className="pb-4 bg-muted/50">
          <h2 className="text-xl font-semibold">Document Actions</h2>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
            <Card className="transition-all hover:shadow-md hover:border-primary/50">
              <CardContent className="flex flex-col items-center gap-3 p-6 text-center">
                <Eye className="w-10 h-10 text-primary/70" />
                <div>
                  <h3 className="font-medium">View PDF</h3>
                  <p className="text-sm text-muted-foreground">View the original PDF document</p>
                </div>
                <Button onClick={handlePdfViewClick} variant="ghost" className="mt-auto">View PDF</Button>
              </CardContent>
            </Card>

            <Card className="transition-all hover:shadow-md hover:border-primary/50">
              <CardContent className="flex flex-col items-center gap-3 p-6 text-center">
                <FilePlus2 className="w-10 h-10 text-primary/70" />
                <div>
                  <h3 className="font-medium">View Markdown</h3>
                  <p className="text-sm text-muted-foreground">View the extracted markdown content</p>
                </div>
                <Button onClick={handleMarkdownViewClick} variant="ghost" className="mt-auto">View Markdown</Button>
              </CardContent>
            </Card>

            <Card className="transition-all hover:shadow-md hover:border-primary/50">
              <CardContent className="flex flex-col items-center gap-3 p-6 text-center">
                <Grid3X3 className="w-10 h-10 text-primary/70" />
                <div>
                  <h3 className="font-medium">Side-by-Side View</h3>
                  <p className="text-sm text-muted-foreground">Compare PDF and markdown side by side</p>
                </div>
                <Button onClick={handleComparisonViewClick} variant="ghost" className="mt-auto">View Comparison</Button>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 