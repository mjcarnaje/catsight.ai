"use client"

import { DocumentCard } from "@/components/document-card"
import { DocumentCardSkeleton } from "@/components/document-card-skeleton"
import { DocumentTable } from "@/components/document-table"
import { DocumentTableSkeleton } from "@/components/document-table-skeleton"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { MultiSelect, Option } from "@/components/ui/multi-select"
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious
} from "@/components/ui/pagination"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/components/ui/use-toast"
import { UploadDocumentsModal } from "@/components/upload-documents-modal"
import { documentsApi } from "@/lib/api"
import { DocumentStatus } from "@/lib/document-status-config"
import { cn } from "@/lib/utils"
import { DocumentFilters, ViewMode } from "@/types"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Calendar, FileText, Filter, LayoutGrid, List, Search, Tag, Upload, X } from "lucide-react"
import { useEffect, useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"

const PAGE_SIZE = 9

export default function DocumentsPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('card')
  const [searchQuery, setSearchQuery] = useState("")
  const [isFilterOpen, setIsFilterOpen] = useState(false)

  const { data: tagOptions, isLoading: isTagOptionsLoading } = useQuery({
    queryKey: ["tags"],
    queryFn: () => documentsApi.getAllTags(),
    staleTime: 60,
  })

  const { data: yearOptions, isLoading: isYearOptionsLoading } = useQuery({
    queryKey: ["years"],
    queryFn: () => documentsApi.getAllYears(),
    staleTime: 60,
  })

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

  const totalPages = paginatedDocuments?.num_pages || 1


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
      <div className="relative py-6 overflow-hidden md:py-10">
        <div className="absolute inset-0 opacity-5">
          <div className="absolute inset-0 bg-grid-primary/[0.1]" style={{ backgroundSize: '30px 30px' }}></div>
        </div>
        <div className="container relative z-10 px-4 mx-auto md:px-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight md:text-3xl lg:text-4xl">Documents</h1>
              <p className="mt-1 text-sm md:text-base text-muted-foreground">
                Manage and organize your uploaded documents
              </p>
            </div>
            <Button
              onClick={() => setIsDialogOpen(true)}
              size="default"
              className="gap-2 mt-4 font-medium transition-all shadow-sm hover:shadow-md md:mt-0"
            >
              <Upload className="w-4 h-4" />
              <span className="hidden sm:inline">Upload Document</span>
              <span className="sm:hidden">Upload</span>
            </Button>
          </div>
        </div>
      </div>

      <div className="container px-4 py-4 mx-auto md:py-8 md:px-6">
        {/* Filters and View Mode */}
        <div className="flex flex-col gap-4 p-4 mb-6 border rounded-lg shadow-sm md:mb-8 bg-card md:flex-row md:items-start md:justify-between">
          <div className="flex flex-col w-full gap-4 md:flex-row md:items-start">
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
                  className="flex items-center justify-between w-full gap-2 md:w-auto"
                >
                  <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4" />
                    <span>Filters</span>
                  </div>
                  {activeFilterCount > 0 && (
                    <Badge variant="secondary" className="ml-2 rounded-full">
                      {activeFilterCount}
                    </Badge>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-sm font-medium">Filter Documents</h4>
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
                    <label htmlFor="year-filter" className="flex items-center gap-1 text-xs font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                      <Calendar className="h-3.5 w-3.5" />
                      Year
                    </label>
                    {isYearOptionsLoading ? (
                      <Skeleton className="h-9" />
                    ) : (
                      <MultiSelect
                        options={yearOptions.map(year => ({ value: year, label: year }))}
                        selected={filters.year || []}
                        onChange={handleYearFilterChange}
                        placeholder="Filter by years"
                      />
                    )}
                  </div>

                  {/* Tags filter */}
                  <div className="grid gap-1.5">
                    <label htmlFor="tags-filter" className="flex items-center gap-1 text-xs font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                      <Tag className="h-3.5 w-3.5" />
                      Tags
                    </label>
                    {isTagOptionsLoading ? (
                      <Skeleton className="h-9" />
                    ) : (
                      <MultiSelect
                        options={tagOptions.map(tag => ({ value: tag, label: tag }))}
                        selected={filters.tags || []}
                        onChange={handleTagsFilterChange}
                        placeholder="Filter by tags"
                      />
                    )}
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
              <span className="hidden text-xs sm:inline">Grid</span>
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
              <span className="hidden text-xs sm:inline">List</span>
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
                  className="w-auto h-auto p-0 ml-1"
                >
                  <X className="w-3 h-3" />
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
                  className="w-auto h-auto p-0 ml-1"
                >
                  <X className="w-3 h-3" />
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
                  className="w-auto h-auto p-0 ml-1"
                >
                  <X className="w-3 h-3" />
                  <span className="sr-only">Remove tag filter</span>
                </Button>
              </Badge>
            ))}

            {activeFilterCount > 1 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="text-xs h-7"
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
                <p className="mb-2 text-xs md:mb-4 md:text-sm text-muted-foreground">
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
              <div className="flex flex-col items-center justify-center py-8 text-center border rounded-lg shadow-inner md:py-16 bg-card/50">
                <div className="w-16 h-16 p-4 mb-4 rounded-full md:w-24 md:h-24 md:mb-6 bg-muted/50">
                  <FileText className="w-full h-full text-muted-foreground" />
                </div>
                <h3 className="mb-2 text-lg font-semibold md:text-xl">No documents found</h3>
                <p className="max-w-md mb-4 text-sm md:mb-6 md:text-base text-muted-foreground">
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
      />
    </div>
  )
} 