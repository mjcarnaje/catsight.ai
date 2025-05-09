import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Skeleton } from "@/components/ui/skeleton";
import { documentsApi, getDocumentPreviewUrl } from "@/lib/api";
import { MARKDOWN_CONVERTERS } from "@/lib/markdown-converter";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, Calendar, ChevronRight, FileText, Layers, Loader2, Search as SearchIcon, Tag } from "lucide-react";
import { useEffect, useState } from "react";
import { Blurhash } from "react-blurhash";
import { useLocation, useNavigate } from "react-router-dom";

// Define the extended SearchResult interface that includes document metadata
export function SearchPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(9);
  const [searchParams, setSearchParams] = useState<{
    query: string;
    page?: number;
    page_size?: number;
  } | null>(null);
  const [loadedImages, setLoadedImages] = useState<Record<string, boolean>>({});

  // Parse query parameters from URL on initial load
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const queryParam = params.get("query");
    const pageParam = params.get("page");

    if (queryParam) {
      setQuery(queryParam);
      setPage(pageParam ? parseInt(pageParam) : 1);

      // Trigger search with URL parameters
      setSearchParams({
        query: queryParam,
        page: pageParam ? parseInt(pageParam) : 1,
        page_size: pageSize
      });
    }
  }, [location.search, pageSize]);

  const { data: results, isLoading } = useQuery({
    queryKey: ["search", searchParams],
    queryFn: () => documentsApi.search(searchParams!),
    enabled: !!searchParams?.query,
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();

    const newParams = {
      query: query.trim(),
      page: 1,
      page_size: pageSize
    };

    setSearchParams(newParams);
    setPage(1);

    // Update URL with search parameters
    const urlParams = new URLSearchParams();
    urlParams.set("query", query.trim());
    urlParams.set("page", "1");

    navigate({
      pathname: location.pathname,
      search: urlParams.toString()
    });
  };

  const handlePageChange = (newPage: number) => {
    if (!searchParams) return;

    const newParams = {
      ...searchParams,
      page: newPage
    };

    setSearchParams(newParams);
    setPage(newPage);

    // Update URL with new page
    const urlParams = new URLSearchParams(location.search);
    urlParams.set("page", newPage.toString());

    navigate({
      pathname: location.pathname,
      search: urlParams.toString()
    });
  };

  const highlightSearchTerm = (text: string, term: string) => {
    if (!term.trim()) return text;

    // Split the term into words and escape special regex characters
    const escapedTerms = term.split(/\s+/).map(word =>
      word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    );

    // Create a regex that matches any of the words
    const regex = new RegExp(`(${escapedTerms.join('|')})`, 'gi');
    return text.replace(regex, '<mark class="bg-primary/20 px-1 rounded">$1</mark>');
  };

  const handleImageLoad = (documentId: string | number) => {
    setLoadedImages(prev => ({
      ...prev,
      [documentId.toString()]: true
    }));
  };

  // Helper to render the markdown converter icon
  const renderConverterIcon = (converterType: string) => {
    if (!converterType || !MARKDOWN_CONVERTERS[converterType]) return null;

    const IconComponent = MARKDOWN_CONVERTERS[converterType].icon;
    if (!IconComponent) return null;

    return <IconComponent className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />;
  };

  return (
    <div className="container max-w-6xl py-8 mx-auto">
      <div className="flex flex-col items-center mb-12">
        <h1 className="mb-3 text-4xl font-bold text-center">
          Document Search
        </h1>
        <p className="max-w-2xl text-center text-muted-foreground">
          Search across your entire document collection with advanced semantic searching
        </p>
      </div>

      <Card className="mb-8 border-0 bg-card/50 backdrop-blur">
        <CardContent className="pt-6">
          <form onSubmit={handleSearch} className="flex flex-col gap-4 md:flex-row">
            <div className="relative flex-1 group">
              <SearchIcon className="absolute w-5 h-5 transition-colors transform -translate-y-1/2 left-3 top-1/2 text-muted-foreground group-focus-within:text-primary" />
              <Input
                placeholder="Search documents..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="h-12 pl-10 transition-all focus-visible:ring-2 focus-visible:ring-primary"
                autoFocus
              />
            </div>
            <Button
              type="submit"
              className="h-12 px-6 transition-all shadow-md"
            >
              <SearchIcon className="w-4 h-4 mr-2" />
              Search
            </Button>
          </form>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-primary">
          <div className="flex flex-col items-center">
            <Loader2 className="w-12 h-12 mb-4 animate-spin" />
            <span className="text-lg">Searching documents...</span>
          </div>
        </div>
      ) : (
        results && (
          <div className="transition-all">
            <div className="flex items-center mb-6">
              <BookOpen className="w-5 h-5 mr-2 text-primary" />
              <h2 className="text-xl font-medium">
                {results.data.count > 0
                  ? `Found ${results.data.count} documents for "${query}"`
                  : `No results found for "${query}"`
                }
              </h2>
            </div>

            {results.data.count > 0 ? (
              <div className="grid grid-cols-1 gap-8 mb-10 animate-fadeIn">
                {(results.data.results).map((document) => (
                  <Card
                    key={document.document_id}
                    className="overflow-hidden transition-all border hover:shadow-md hover:border-primary/20 group"
                  >
                    <div className="flex flex-col lg:flex-row">
                      {/* Document Info Section */}
                      <div className="flex p-5 border-b lg:border-b-0 lg:border-r lg:w-1/3">
                        <div className="relative flex-shrink-0 w-20 mr-4 h-28 sm:w-28 sm:h-36">
                          {document.preview_image && document.blurhash ? (
                            <>
                              {!loadedImages[document.document_id] && (
                                <div className="absolute inset-0">
                                  <Blurhash
                                    hash={document.blurhash}
                                    width="100%"
                                    height="100%"
                                    resolutionX={32}
                                    resolutionY={32}
                                    punch={1}
                                  />
                                </div>
                              )}
                              <img
                                src={getDocumentPreviewUrl(document.preview_image)}
                                alt={document.title}
                                className={`w-full h-full object-cover transition-opacity duration-500 ${loadedImages[document.document_id] ? 'opacity-100' : 'opacity-0'
                                  } group-hover:scale-105 transition-transform duration-700`}
                                onLoad={() => handleImageLoad(document.document_id)}
                              />
                            </>
                          ) : (
                            <div className="flex items-center justify-center w-full h-full bg-muted/30">
                              <FileText className="w-8 h-8 text-muted-foreground/50" />
                            </div>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <h3 className="text-lg font-semibold truncate transition-colors group-hover:text-primary">
                              {document.title}
                            </h3>
                            <Badge variant="outline" className="ml-2 shadow-sm whitespace-nowrap">
                              Match: {(document.max_score * 100).toFixed(1)}%
                            </Badge>
                          </div>

                          {document.description && (
                            <p className="mb-3 text-sm text-muted-foreground line-clamp-2">{document.description}</p>
                          )}

                          <div className="flex items-center mb-3 text-xs text-muted-foreground">
                            <Calendar className="w-3.5 h-3.5 mr-1" />
                            <span>{new Date(document.created_at).toLocaleDateString()}</span>
                          </div>

                          <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
                            <div className="flex items-center gap-1.5 bg-background p-1.5 rounded-md overflow-hidden">
                              <Layers className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                              <span className="font-medium truncate">{document.no_of_chunks || 0} chunks</span>
                            </div>

                            <div className="flex items-center gap-1.5 bg-background p-1.5 rounded-md overflow-hidden">
                              <Tag className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                              <span className="font-medium truncate">{document.file_type}</span>
                            </div>

                            {document.markdown_converter && MARKDOWN_CONVERTERS[document.markdown_converter] && (
                              <div className="flex items-center gap-1.5 bg-background p-1.5 rounded-md overflow-hidden">
                                {renderConverterIcon(document.markdown_converter)}
                                <span className="font-medium truncate">{MARKDOWN_CONVERTERS[document.markdown_converter].label}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Search Results Section */}
                      <div className="flex-1 p-5">
                        <div className="mb-3">
                          <h4 className="flex items-center font-medium text-primary">
                            <SearchIcon className="w-4 h-4 mr-1.5" />
                            Found {document.results.length} matching chunks
                          </h4>
                        </div>

                        <div className="pr-2 space-y-3 overflow-y-auto max-h-80 custom-scrollbar">
                          {document.results.slice(0, 3).map((result, idx) => (
                            <div
                              key={`${document.document_id}-${result.chunk_index}-${idx}`}
                              className="p-3 transition-colors border rounded-lg bg-muted/30 hover:bg-muted/50"
                            >
                              <div className="flex justify-between items-center mb-1.5 text-xs text-muted-foreground">
                                <span>Chunk #{result.chunk_index}</span>
                                <Badge variant="outline" className="text-xs">
                                  {(result.score * 100).toFixed(1)}%
                                </Badge>
                              </div>
                              <div
                                className="prose-sm prose max-w-none"
                                dangerouslySetInnerHTML={{
                                  __html: highlightSearchTerm(result.snippet || result.text, query)
                                }}
                              />
                            </div>
                          ))}

                          {document.results.length > 3 && (
                            <div className="py-2 text-center">
                              <span className="text-sm text-muted-foreground">
                                + {document.results.length - 3} more matching chunks
                              </span>
                            </div>
                          )}
                        </div>

                        <div className="flex justify-end mt-4">
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1.5 transition-colors hover:bg-primary hover:text-primary-foreground"
                            onClick={() => navigate(`/documents/${document.document_id}?highlight=${query}`)}
                          >
                            <BookOpen className="w-4 h-4" />
                            View full document
                            <ChevronRight className="w-4 h-4 ml-1 transition-transform group-hover:translate-x-0.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="p-8 text-center border-dashed">
                <div className="flex flex-col items-center">
                  <SearchIcon className="w-12 h-12 mb-4 text-muted-foreground" />
                  <h3 className="mb-2 text-xl font-medium">No results found</h3>
                  <p className="text-muted-foreground">
                    Try using different keywords or more general terms
                  </p>
                </div>
              </Card>
            )}

            {/* Pagination */}
            {results.data.count > 0 && (
              <Pagination className="mt-8">
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      onClick={() => handlePageChange(Math.max(1, page - 1))}
                      className={page === 1
                        ? "pointer-events-none opacity-50"
                        : "cursor-pointer hover:bg-muted transition-colors"}
                    />
                  </PaginationItem>

                  {Array.from({ length: Math.min(5, results.data.num_pages) }, (_, i) => {
                    // Show first page, last page, and pages around current page
                    let pageNum;
                    if (results.data.num_pages <= 5) {
                      pageNum = i + 1;
                    } else if (page <= 3) {
                      pageNum = i + 1;
                    } else if (page >= results.data.num_pages - 2) {
                      pageNum = results.data.num_pages - 4 + i;
                    } else {
                      pageNum = page - 2 + i;
                    }

                    return (
                      <PaginationItem key={pageNum}>
                        <PaginationLink
                          isActive={pageNum === page}
                          onClick={() => handlePageChange(pageNum)}
                        >
                          {pageNum}
                        </PaginationLink>
                      </PaginationItem>
                    );
                  })}

                  <PaginationItem>
                    <PaginationNext
                      onClick={() => handlePageChange(Math.min(results.data.num_pages, page + 1))}
                      className={page === results.data.num_pages
                        ? "pointer-events-none opacity-50"
                        : "cursor-pointer hover:bg-muted transition-colors"}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            )}
          </div>
        )
      )}

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }
        .custom-scrollbar {
          scrollbar-width: thin;
          scrollbar-color: rgba(155, 155, 155, 0.5) transparent;
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background-color: rgba(155, 155, 155, 0.5);
          border-radius: 20px;
        }
      `}</style>
    </div>
  );
}
