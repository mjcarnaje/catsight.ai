"use client"

import { DocumentCard } from "@/components/document-card"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/use-toast"
import { UploadDocumentsModal } from "@/components/upload-documents-modal"
import { documentsApi } from "@/lib/api"
import { DocumentStatus, getStatusInfo } from "@/lib/document-status-config"
import { Document, DocumentFilters, PaginatedResponse, ViewMode } from "@/types"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { FileText, Grid, List, Search, Upload, Filter, LayoutGrid, Tag, Calendar } from "lucide-react"
import { useState, useEffect } from "react"
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
import { useNavigate, useLocation } from "react-router-dom"
import { cn } from "@/lib/utils"
import { Separator } from "@/components/ui/separator"
import { DocumentCardSkeleton } from "@/components/document-card-skeleton"
import { DocumentTableSkeleton } from "@/components/document-table-skeleton"
import { MultiSelect, Option } from "@/components/ui/multi-select"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Badge } from "@/components/ui/badge"
import { X } from "lucide-react"

const PAGE_SIZE = 9

export default function DocumentsPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('card')
  const [searchQuery, setSearchQuery] = useState("")
  const [tagOptions, setTagOptions] = useState<Option[]>([])
  const [yearOptions, setYearOptions] = useState<Option[]>([])
  const [isFilterOpen, setIsFilterOpen] = useState(false)

  const { toast } = useToast()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const location = useLocation()

  // Get search params from URL
  const searchParams = new URLSearchParams(location.search)
  const pageParam = searchParams.get('page')
  const statusParam = searchParams.get('status')
  const yearParam = searchParams.get('year')
  const tagsParam = searchParams.get('tags')

  // Set initial values from URL or defaults
  const [currentPage, setCurrentPage] = useState(pageParam ? parseInt(pageParam) : 1)
  const [filters, setFilters] = useState<DocumentFilters>({
    status: statusParam as DocumentStatus || "all",
    year: yearParam ? yearParam.split(',') : [],
    tags: tagsParam ? tagsParam.split(',') : [],
  })

  // Count active filters
  const activeFilterCount = (
    (filters.status !== "all" ? 1 : 0) +
    (filters.tags && filters.tags.length > 0 ? 1 : 0) +
    (filters.year && filters.year.length > 0 ? 1 : 0)
  )

  // Update URL when filters change
  useEffect(() => {
    const params = new URLSearchParams()

    if (currentPage > 1) {
      params.set('page', currentPage.toString())
    }

    if (filters.status && filters.status !== "all") {
      params.set('status', filters.status)
    }

    if (filters.year && filters.year.length > 0) {
      params.set('year', filters.year.join(','))
    }

    if (filters.tags && filters.tags.length > 0) {
      params.set('tags', filters.tags.join(','))
    }

    const newSearch = params.toString()
    const newPath = newSearch ? `${location.pathname}?${newSearch}` : location.pathname

    // Only update if the URL would change
    if (location.search !== `?${newSearch}`) {
      navigate(newPath, { replace: true })
    }
  }, [currentPage, filters, location.pathname, navigate])

  // Update state when URL changes
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const pageParam = params.get('page')
    const statusParam = params.get('status')
    const yearParam = params.get('year')
    const tagsParam = params.get('tags')

    if (pageParam) {
      setCurrentPage(parseInt(pageParam))
    } else if (currentPage !== 1) {
      setCurrentPage(1)
    }

    setFilters(prev => ({
      ...prev,
      status: statusParam && Object.values(DocumentStatus).includes(statusParam as DocumentStatus)
        ? statusParam as DocumentStatus
        : "all",
      year: yearParam ? yearParam.split(',') : [],
      tags: tagsParam ? tagsParam.split(',') : []
    }))
  }, [location.search])

  const { data: paginatedDocuments, isLoading: isDocumentsLoading } = useQuery({
    queryKey: ["documents", currentPage, PAGE_SIZE, filters],
    queryFn: () => {
      const params: Record<string, string | number> = {
        page: currentPage,
        page_size: PAGE_SIZE
      }

      if (filters.status && filters.status !== "all") {
        params.status = filters.status
      }

      if (filters.year && filters.year.length > 0) {
        params.year = filters.year.join(',')
      }

      if (filters.tags && filters.tags.length > 0) {
        params.tags = filters.tags.join(',')
      }

      return documentsApi.getAll(currentPage, PAGE_SIZE, params).then((res) => res.data)
    },
    refetchInterval: 5000,
  })

  // Extract unique tags and years from all documents for the filter options
  useEffect(() => {
    if (paginatedDocuments?.results) {
      const uniqueTags = new Set<string>()
      const uniqueYears = new Set<string>()

      paginatedDocuments.results.forEach(doc => {
        // Extract tags
        if (doc.tags && Array.isArray(doc.tags)) {
          doc.tags.forEach(tag => {
            if (tag) uniqueTags.add(tag)
          })
        }

        // Extract years
        if (doc.year !== undefined && doc.year !== null) {
          uniqueYears.add(doc.year.toString())
        }
      })

      const sortedTags = Array.from(uniqueTags).sort()
      setTagOptions(sortedTags.map(tag => ({ value: tag, label: tag })))

      const sortedYears = Array.from(uniqueYears).sort((a, b) => parseInt(b) - parseInt(a))
      setYearOptions(sortedYears.map(year => ({ value: year, label: year })))
    }
  }, [paginatedDocuments])

  const totalPages = paginatedDocuments?.num_pages || 1

  const uploadMutation = useMutation({
    mutationFn: ({
      files,
      markdown_converter,
      summarization_model,
    }: {
      files: File[];
      markdown_converter: string;
      summarization_model: string;
    }) => documentsApi.upload(files, markdown_converter, summarization_model),
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

  // Handle filter changes
  const handleStatusFilterChange = (value: string) => {
    setFilters(prev => ({
      ...prev,
      status: value as DocumentStatus | "all"
    }));
    setCurrentPage(1);
  };

  const handleYearFilterChange = (values: string[]) => {
    setFilters(prev => ({
      ...prev,
      year: values
    }));
    setCurrentPage(1);
  };

  const handleTagsFilterChange = (values: string[]) => {
    setFilters(prev => ({
      ...prev,
      tags: values
    }));
    setCurrentPage(1);
  };

  const clearFilters = () => {
    setFilters({
      status: "all",
      year: [],
      tags: []
    });
    setCurrentPage(1);
  };

  // Handle search
  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!searchQuery.trim()) return

    // Redirect to search page with query parameters
    const params = new URLSearchParams()
    params.set("query", searchQuery)
    if (filters.status !== "all") {
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
        <div className="flex flex-col gap-4 p-4 mb-6 md:mb-8 border rounded-lg shadow-sm bg-card md:flex-row md:items-start md:justify-between">
          <div className="flex flex-col gap-4 w-full md:flex-row md:items-start">
            <form onSubmit={handleSearch} className="relative w-full md:w-80">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search documents..."
                className="pr-4 border rounded-full pl-9 bg-background h-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </form>

            <Popover open={isFilterOpen} onOpenChange={setIsFilterOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full md:w-auto flex items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4" />
                    <span>Filters</span>
                  </div>
                  {activeFilterCount > 0 && (
                    <Badge variant="secondary" className="rounded-full ml-2">
                      {activeFilterCount}
                    </Badge>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-medium text-sm">Filter Documents</h4>
                  {activeFilterCount > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearFilters}
                      className="h-8 text-xs"
                    >
                      Clear all
                    </Button>
                  )}
                </div>

                <div className="space-y-4">
                  {/* Status filter */}
                  <div className="grid gap-1.5">
                    <label htmlFor="status-filter" className="text-xs font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                      Status
                    </label>
                    <Select
                      value={filters.status}
                      onValueChange={handleStatusFilterChange}
                    >
                      <SelectTrigger id="status-filter" className="h-9">
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

                  {/* Year filter - now using MultiSelect */}
                  <div className="grid gap-1.5">
                    <label htmlFor="year-filter" className="text-xs font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" />
                      Year
                    </label>
                    <MultiSelect
                      options={yearOptions}
                      selected={filters.year || []}
                      onChange={handleYearFilterChange}
                      placeholder="Filter by years"
                    />
                  </div>

                  {/* Tags filter */}
                  <div className="grid gap-1.5">
                    <label htmlFor="tags-filter" className="text-xs font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex items-center gap-1">
                      <Tag className="h-3.5 w-3.5" />
                      Tags
                    </label>
                    <MultiSelect
                      options={tagOptions}
                      selected={filters.tags || []}
                      onChange={handleTagsFilterChange}
                      placeholder="Filter by tags"
                    />
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>

          {/* Applied filters display */}
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

        {/* Active filters display */}
        {activeFilterCount > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {filters.status !== "all" && (
              <Badge variant="secondary" className="flex items-center gap-1">
                Status: {filters.status.charAt(0).toUpperCase() + filters.status.slice(1).replace(/_/g, ' ')}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleStatusFilterChange("all")}
                  className="h-auto w-auto p-0 ml-1"
                >
                  <X className="h-3 w-3" />
                  <span className="sr-only">Remove status filter</span>
                </Button>
              </Badge>
            )}

            {filters.year && filters.year.length > 0 && filters.year.map(year => (
              <Badge key={`year-${year}`} variant="secondary" className="flex items-center gap-1">
                Year: {year}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleYearFilterChange(filters.year?.filter(y => y !== year) || [])}
                  className="h-auto w-auto p-0 ml-1"
                >
                  <X className="h-3 w-3" />
                  <span className="sr-only">Remove year filter</span>
                </Button>
              </Badge>
            ))}

            {filters.tags && filters.tags.map(tag => (
              <Badge key={tag} variant="secondary" className="flex items-center gap-1">
                {tag}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleTagsFilterChange(filters.tags?.filter(t => t !== tag) || [])}
                  className="h-auto w-auto p-0 ml-1"
                >
                  <X className="h-3 w-3" />
                  <span className="sr-only">Remove tag filter</span>
                </Button>
              </Badge>
            ))}

            {activeFilterCount > 1 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="h-7 text-xs"
              >
                Clear all
              </Button>
            )}
          </div>
        )}

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
                  {searchQuery || filters.status !== "all"
                    ? "Try adjusting your filters to see more results."
                    : "Upload documents to make them available for search and chat."}
                </p>
                {!searchQuery && filters.status === "all" && (
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
        onUpload={(files, markdown_converter, summarization_model) =>
          uploadMutation.mutate({ files, markdown_converter, summarization_model })
        }
        isUploading={uploadMutation.isPending}
      />
    </div>
  )
} 