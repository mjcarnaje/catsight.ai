import { Markdown } from "@/components/markdown";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { documentsApi, SearchResult } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { FileText, Loader2, Search as SearchIcon, BookOpen } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

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
    return text.replace(regex, '<mark class="bg-blue-500/30 px-1 rounded">$1</mark>');
  };

  return (
    <div className="container max-w-6xl py-8 mx-auto">
      <div className="flex flex-col items-center mb-12">
        <h1 className="mb-3 text-4xl font-bold text-center text-transparent bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text">
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
                className="h-12 pl-10 transition-all focus-visible:ring-2 focus-visible:ring-blue-500"
                autoFocus
              />
            </div>
            <Button
              type="submit"
              className="h-12 px-6 transition-all shadow-md bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800"
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
              <BookOpen className="w-5 h-5 mr-2 text-blue-600" />
              <h2 className="text-xl font-medium">
                {results.data.count > 0
                  ? `Found ${results.data.count} results for "${query}"`
                  : `No results found for "${query}"`
                }
              </h2>
            </div>

            {results.data.count > 0 ? (
              <div className="grid gap-6 animate-fadeIn">
                {results.data.results.map((result, idx) => (
                  <Card
                    key={`${idx}-${result.text.substring(0, 20)}`}
                    className="overflow-hidden transition-all border hover:shadow-md hover:border-blue-200 group"
                  >
                    <CardContent className="p-0">
                      <div className="p-5">
                        <div className="flex items-start gap-4">
                          <div className="p-2 mt-1 text-blue-700 transition-colors bg-blue-100 rounded-full group-hover:bg-blue-200">
                            <FileText className="w-5 h-5" />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-1">
                              <h3 className="text-lg font-medium text-blue-800">
                                {result.source ? result.source.split('/').pop() : 'Document'}
                              </h3>
                              <Badge className="text-blue-700 transition-colors bg-blue-100 shadow-sm hover:bg-blue-200">
                                Match: {(result.score * 100).toFixed(1)}%
                              </Badge>
                            </div>

                            <div className="p-4 mt-3 border rounded-lg bg-slate-50/50">
                              <div className="flex items-center mb-2 text-xs text-slate-500">
                                <span>Chunk #{result.chunk_index}</span>
                              </div>
                              <div
                                className="prose-sm prose max-w-none"
                                dangerouslySetInnerHTML={{
                                  __html: highlightSearchTerm(result.snippet || result.text, query)
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
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
                        : "cursor-pointer hover:bg-blue-50 transition-colors"}
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
                          className={pageNum === page
                            ? "bg-blue-600 hover:bg-blue-700"
                            : "hover:bg-blue-50 transition-colors"}
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
                        : "cursor-pointer hover:bg-blue-50 transition-colors"}
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
      `}</style>
    </div>
  );
}
