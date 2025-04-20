"use client"

import { DocumentCard } from "@/components/document-card"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/use-toast"
import { UploadDocumentsModal } from "@/components/upload-documents-modal"
import { documentsApi } from "@/lib/api"
import { DocumentStatus, getStatusInfo } from "@/lib/document-status"
import { Document, ViewMode } from "@/types"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { FileText, Grid, List, Search, Upload } from "lucide-react"
import { useState } from "react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious
} from "@/components/ui/pagination"
import { DocumentTable } from "@/components/document-table"

const PAGE_SIZE = 9

export default function DocumentsPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('card')
  const [currentPage, setCurrentPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState<DocumentStatus | "all">("all")
  const [searchQuery, setSearchQuery] = useState("")

  const { toast } = useToast()
  const queryClient = useQueryClient()

  const { data: allDocuments, isLoading: isDocumentsLoading } = useQuery({
    queryKey: ["documents"],
    queryFn: () => documentsApi.getAll().then((res) => res.data),
    refetchInterval: 5000,
  })

  const filteredDocuments = allDocuments
    ? allDocuments
      .filter(doc =>
        statusFilter === "all" || doc.status === statusFilter
      )
      .filter(doc =>
        searchQuery === "" ||
        doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (doc.description && doc.description.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : []

  const totalPages = Math.ceil(filteredDocuments.length / PAGE_SIZE)

  // Get paginated documents
  const paginatedDocuments = filteredDocuments
    .slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

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

  // Handle page change
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

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

      {/* Filters and View Mode */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          <div className="relative w-64">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search documents..."
              className="pl-8"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Select
            value={statusFilter}
            onValueChange={(value) => setStatusFilter(value as DocumentStatus | "all")}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              {Object.values(DocumentStatus).map((status) => (
                <SelectItem key={status} value={status}>
                  {status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' ')}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={viewMode === 'card' ? "default" : "outline"}
            size="icon"
            onClick={() => setViewMode('card')}
          >
            <Grid className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === 'table' ? "default" : "outline"}
            size="icon"
            onClick={() => setViewMode('table')}
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {isDocumentsLoading ? (
        <div className="py-12 text-center">
          <div className="w-8 h-8 mx-auto border-4 rounded-full animate-spin border-primary border-t-transparent"></div>
          <p className="mt-4 text-muted-foreground">Loading documents...</p>
        </div>
      ) : (
        <>
          {viewMode === 'card' ? (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {paginatedDocuments.map((doc) => (
                <DocumentCard key={doc.id} doc={doc} />
              ))}
            </div>
          ) : (
            <DocumentTable documents={paginatedDocuments} />
          )}

          {/* Pagination */}
          {filteredDocuments.length > PAGE_SIZE && (
            <Pagination className="mt-8">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                    className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                  />
                </PaginationItem>

                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <PaginationItem key={page}>
                    <PaginationLink
                      isActive={page === currentPage}
                      onClick={() => handlePageChange(page)}
                    >
                      {page}
                    </PaginationLink>
                  </PaginationItem>
                ))}

                <PaginationItem>
                  <PaginationNext
                    onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
                    className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          )}

          {filteredDocuments.length === 0 && (
            <div className="py-12 text-center">
              <FileText className="w-12 h-12 mx-auto text-muted-foreground" />
              <h3 className="mt-4 text-lg font-semibold">No documents found</h3>
              <p className="mb-4 text-muted-foreground">
                {searchQuery || statusFilter !== "all"
                  ? "Try adjusting your filters to see more results."
                  : "Upload documents to make them available for search and chat."}
              </p>
              {!searchQuery && statusFilter === "all" && (
                <Button onClick={() => setIsDialogOpen(true)}>
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Document
                </Button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
