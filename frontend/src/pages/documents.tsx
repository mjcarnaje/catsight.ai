"use client"

import type React from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { useToast } from "@/components/ui/use-toast"
import { UploadDocumentsModal } from "@/components/upload-documents-modal"
import { api, Document, documentsApi } from "@/lib/api"
import { DocumentStatus, getDocumentStatus } from "@/lib/document-status"
import { Download, FileText, Trash, Upload } from "lucide-react"
import { useEffect, useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<Document[]>([])
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  // Fetch documents on page load
  useEffect(() => {
    fetchDocuments()
  }, [])

  const fetchDocuments = async () => {
    try {
      setLoading(true)

      const response = await documentsApi.getAll()
      setDocuments(response.data)
    } catch (error) {
      console.error("Failed to fetch documents:", error)
      toast({
        title: "Error",
        description: "Failed to fetch documents. Please try again later.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files)
      setSelectedFiles(files)
    }
  }

  const handleDeleteDocument = async (id: number) => {
    try {
      await documentsApi.delete(id)
      setDocuments(documents.filter(doc => doc.id !== id))
      toast({
        title: "Success",
        description: "Document deleted successfully.",
      })
    } catch (error) {
      console.error("Failed to delete document:", error)
      toast({
        title: "Error",
        description: "Failed to delete document. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleRetryProcessing = async (id: number) => {
    try {
      await documentsApi.retry(id)
      toast({
        title: "Success",
        description: "Document processing restarted.",
      })
      fetchDocuments()
    } catch (error) {
      console.error("Failed to retry document processing:", error)
      toast({
        title: "Error",
        description: "Failed to restart document processing. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleDownload = async (id: number) => {
    try {
      // For downloading files, we use a direct API call with blob response type instead of using documentsApi helper
      const response = await api.get(`/documents/${id}/raw`, {
        responseType: 'blob'
      });

      // Create a download link for the document
      const url = window.URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `document-${id}.pdf`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error("Failed to download document:", error);
      toast({
        title: "Error",
        description: "Failed to download document. Please try again.",
        variant: "destructive",
      });
    }
  };

  const getDocumentStatusInfo = (status: DocumentStatus, isFailed: boolean) => {
    if (isFailed) {
      return {
        label: "Failed",
        variant: "destructive" as const,
        progress: 0
      }
    }

    const statusInfo = getDocumentStatus(status)
    return {
      label: statusInfo.label,
      variant: status === DocumentStatus.COMPLETED ? "default" as const : "outline" as const,
      progress: statusInfo.progress
    }
  }

  const queryClient = useQueryClient()

  const uploadMutation = useMutation({
    mutationFn: ({
      files,
      markdown_converter,
    }: {
      files: File[];
      markdown_converter: string;
    }) => documentsApi.upload(files, markdown_converter),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      setIsDialogOpen(false);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to upload files",
        variant: "destructive",
      });
    },
  });


  return (
    <div className="container py-10 mx-auto">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold">Documents</h1>
        <Button onClick={() => setIsDialogOpen(true)}>
          <Upload className="w-4 h-4 mr-2" />
          Upload Document
        </Button>
        <UploadDocumentsModal
          open={isDialogOpen}
          onOpenChange={setIsDialogOpen}
          onUpload={(files, markdown_converter) => uploadMutation.mutate({ files, markdown_converter })}
          isUploading={uploadMutation.isPending}
        />
      </div>

      {loading ? (
        <div className="py-12 text-center">
          <div className="w-8 h-8 mx-auto border-4 rounded-full animate-spin border-primary border-t-transparent"></div>
          <p className="mt-4 text-muted-foreground">Loading documents...</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {documents.map((doc) => {
              const statusInfo = getDocumentStatusInfo(doc.status, doc.is_failed)

              return (
                <Card key={doc.id} className="transition-shadow hover:shadow-md">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg">{doc.title}</CardTitle>
                        <CardDescription>{new Date(doc.created_at).toLocaleDateString()}</CardDescription>
                      </div>
                      <Badge variant={statusInfo.variant}>
                        {statusInfo.label}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="mb-2 text-sm">{doc.description || "No description available"}</p>
                    {doc.status !== DocumentStatus.COMPLETED && !doc.is_failed && (
                      <Progress value={statusInfo.progress} className="h-2 mt-2" />
                    )}
                    <div className="flex justify-between mt-2 text-xs text-muted-foreground">
                      <span>{doc.no_of_chunks || 0} chunks</span>
                      <span>ID: {doc.id}</span>
                    </div>
                  </CardContent>
                  <CardFooter className="flex justify-between">
                    <Button variant="outline" size="sm" onClick={() => window.location.href = `/document/${doc.id}`}>
                      <FileText className="w-4 h-4 mr-2" />
                      View
                    </Button>
                    <div className="flex space-x-2">
                      <Button variant="outline" size="sm" onClick={() => handleDownload(doc.id)}>
                        <Download className="w-4 h-4 mr-2" />
                        Download
                      </Button>
                      {doc.is_failed && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRetryProcessing(doc.id)}
                        >
                          Retry
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
                        onClick={() => handleDeleteDocument(doc.id)}
                      >
                        <Trash className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardFooter>
                </Card>
              )
            })}
          </div>

          {documents.length === 0 && (
            <div className="py-12 text-center">
              <FileText className="w-12 h-12 mx-auto text-muted-foreground" />
              <h3 className="mt-4 text-lg font-semibold">No documents yet</h3>
              <p className="mb-4 text-muted-foreground">Upload documents to make them available for search and chat.</p>
              <Button onClick={() => setIsDialogOpen(true)}>
                <Upload className="w-4 h-4 mr-2" />
                Upload Document
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
