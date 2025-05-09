"use client"

import { DocumentCard } from "@/components/document-card"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/use-toast"
import { UploadDocumentsModal } from "@/components/upload-documents-modal"
import { documentsApi } from "@/lib/api"
import { DocumentStatus, getStatusInfo } from "@/lib/document-status"
import { Document, PaginatedResponse, ViewMode } from "@/types"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { FileText, Grid, List, Search, Upload, Filter, LayoutGrid } from "lucide-react"
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
import { useNavigate } from "react-router-dom"
import { cn } from "@/lib/utils"
import { Separator } from "@/components/ui/separator"
import { DocumentCardSkeleton } from "@/components/document-card-skeleton"
import { DocumentTableSkeleton } from "@/components/document-table-skeleton"

const PAGE_SIZE = 9

export default function DocumentsPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('card')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize] = useState(PAGE_SIZE)
  const [statusFilter, setStatusFilter] = useState<DocumentStatus | "all">("all")
  const [searchQuery, setSearchQuery] = useState("")

  const { toast } = useToast()
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  const { data: paginatedDocuments, isLoading: isDocumentsLoading } = useQuery({
    queryKey: ["documents", currentPage, pageSize],
    queryFn: () => documentsApi.getAll(currentPage, pageSize).then((res) => res.data),
    refetchInterval: 5000,
  })

  const totalPages = paginatedDocuments?.num_pages || 1

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
    // Reset any filters when changing pages
    if (statusFilter !== "all" || searchQuery !== "") {
      setStatusFilter("all");
      setSearchQuery("");
    }
  };

  // Handle search
  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!searchQuery.trim()) return

    // Redirect to search page with query parameters
    const params = new URLSearchParams()
    params.set("query", searchQuery)
    if (statusFilter !== "all") {
      params.set("title", searchQuery)
    }

    navigate({
      pathname: "/search",
      search: params.toString()
    })
  }

  return (
    <div className="min-h-screen">
      {/* Hero Header */}
      <div className="relative py-6 md:py-10 overflow-hidden">
        <div className="absolute inset-0 opacity-5">
          <div className="absolute inset-0 bg-grid-primary/[0.1]" style={{ backgroundSize: '30px 30px' }}></div>
        </div>
        <div className="container relative z-10 mx-auto px-4 md:px-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold tracking-tight">Documents</h1>
              <p className="mt-1 text-sm md:text-base text-muted-foreground">
                Manage and organize your uploaded documents
              </p>
            </div>
            <Button
              onClick={() => setIsDialogOpen(true)}
              size="default"
              className="gap-2 font-medium transition-all shadow-sm hover:shadow-md mt-4 md:mt-0"
            >
              <Upload className="w-4 h-4" />
              <span className="hidden sm:inline">Upload Document</span>
              <span className="sm:hidden">Upload</span>
            </Button>
          </div>
        </div>
      </div>

      <div className="container py-4 md:py-8 mx-auto px-4 md:px-6">
        {/* Filters and View Mode */}
        <div className="flex flex-col gap-4 p-4 mb-6 md:mb-8 border rounded-lg shadow-sm bg-card md:flex-row md:items-center md:justify-between">
          <div className="flex flex-col gap-4 w-full md:flex-row md:items-center">
            <form onSubmit={handleSearch} className="relative w-full md:w-80">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search documents..."
                className="pr-4 border rounded-full pl-9 bg-background h-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </form>
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <Select
                value={statusFilter}
                onValueChange={(value) => setStatusFilter(value as DocumentStatus | "all")}
              >
                <SelectTrigger className="w-full md:w-[180px] h-9 rounded-full">
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
          </div>
          <div className="flex items-center self-end gap-2 p-1 border rounded-full md:self-auto bg-muted/30">
            <Button
              variant={viewMode === 'card' ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode('card')}
              className={cn(
                "gap-2 rounded-full",
                viewMode === 'card' ? "shadow-sm" : "hover:bg-background"
              )}
            >
              <LayoutGrid className="w-4 h-4" />
              <span className="text-xs hidden sm:inline">Grid</span>
            </Button>
            <Button
              variant={viewMode === 'table' ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode('table')}
              className={cn(
                "gap-2 rounded-full",
                viewMode === 'table' ? "shadow-sm" : "hover:bg-background"
              )}
            >
              <List className="w-4 h-4" />
              <span className="text-xs hidden sm:inline">List</span>
            </Button>
          </div>
        </div>

        {isDocumentsLoading ? (
          viewMode === 'card' ? (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {Array(6).fill(0).map((_, index) => (
                <DocumentCardSkeleton key={index} />
              ))}
            </div>
          ) : (
            <div className="overflow-hidden border rounded-lg shadow-sm">
              <div className="w-full overflow-x-auto">
                <DocumentTableSkeleton rows={5} />
              </div>
            </div>
          )
        ) : (
          <>
            {viewMode === 'card' ? (
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 auto-rows-fr">
                {paginatedDocuments?.results.map((doc) => (
                  <DocumentCard key={doc.id} doc={doc} />
                ))}
              </div>
            ) : (
              <div className="overflow-hidden border rounded-lg shadow-sm">
                <div className="w-full overflow-x-auto">
                  <DocumentTable documents={paginatedDocuments?.results || []} />
                </div>
              </div>
            )}

            {/* Pagination */}
            {paginatedDocuments && paginatedDocuments.count > PAGE_SIZE && (
              <div className="flex flex-col items-center mt-6 md:mt-10">
                <p className="mb-2 md:mb-4 text-xs md:text-sm text-muted-foreground">
                  Showing {(currentPage - 1) * PAGE_SIZE + 1} to {Math.min(currentPage * PAGE_SIZE, paginatedDocuments.count)} of {paginatedDocuments.count} documents
                </p>
                <Pagination>
                  <PaginationContent className="flex flex-wrap justify-center gap-1">
                    <PaginationItem>
                      <PaginationPrevious
                        onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                        className={cn(
                          "transition-all rounded-full",
                          currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer hover:bg-muted"
                        )}
                      />
                    </PaginationItem>

                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                      .filter(page => {
                        // On mobile, show fewer page numbers
                        const isMobile = window.innerWidth < 640;
                        if (isMobile) {
                          return page === 1 || page === totalPages ||
                            (page >= currentPage - 1 && page <= currentPage + 1);
                        }
                        return true;
                      })
                      .map((page, index, array) => {
                        // Add ellipsis if there are gaps in page numbers
                        const showEllipsisBefore = index > 0 && array[index - 1] !== page - 1;
                        const showEllipsisAfter = index < array.length - 1 && array[index + 1] !== page + 1;

                        return (
                          <>
                            {showEllipsisBefore && (
                              <PaginationItem key={`ellipsis-before-${page}`} className="hidden sm:block">
                                <span className="px-3 py-2">...</span>
                              </PaginationItem>
                            )}
                            <PaginationItem key={page}>
                              <PaginationLink
                                isActive={page === currentPage}
                                onClick={() => handlePageChange(page)}
                                className={cn(
                                  "rounded-full font-medium transition-all",
                                  page === currentPage && "shadow-sm"
                                )}
                              >
                                {page}
                              </PaginationLink>
                            </PaginationItem>
                            {showEllipsisAfter && (
                              <PaginationItem key={`ellipsis-after-${page}`} className="hidden sm:block">
                                <span className="px-3 py-2">...</span>
                              </PaginationItem>
                            )}
                          </>
                        );
                      })}

                    <PaginationItem>
                      <PaginationNext
                        onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
                        className={cn(
                          "transition-all rounded-full",
                          currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer hover:bg-muted"
                        )}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            )}

            {paginatedDocuments?.results.length === 0 && (
              <div className="flex flex-col items-center justify-center py-8 md:py-16 text-center border rounded-lg shadow-inner bg-card/50">
                <div className="w-16 h-16 md:w-24 md:h-24 p-4 mb-4 md:mb-6 rounded-full bg-muted/50">
                  <FileText className="w-full h-full text-muted-foreground" />
                </div>
                <h3 className="mb-2 text-lg md:text-xl font-semibold">No documents found</h3>
                <p className="max-w-md mb-4 md:mb-6 text-sm md:text-base text-muted-foreground">
                  {searchQuery || statusFilter !== "all"
                    ? "Try adjusting your filters to see more results."
                    : "Upload documents to make them available for search and chat."}
                </p>
                {!searchQuery && statusFilter === "all" && (
                  <Button
                    onClick={() => setIsDialogOpen(true)}
                    size="lg"
                    className="gap-2 transition-all shadow-sm hover:shadow-md"
                  >
                    <Upload className="w-4 h-4" />
                    Upload Your First Document
                  </Button>
                )}
              </div>
            )}
          </>
        )}
      </div>

      <UploadDocumentsModal
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        onUpload={(files, markdown_converter) => uploadMutation.mutate({ files, markdown_converter })}
        isUploading={uploadMutation.isPending}
      />
    </div>
  )
} 