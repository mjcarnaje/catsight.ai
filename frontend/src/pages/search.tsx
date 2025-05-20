import {
  SearchDocumentCard,
  SearchDocumentCardSkeleton,
} from "@/components/search-document-card";
import {
  SearchSummary,
  SearchSummarySkeleton,
} from "@/components/search-summary";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { MultiSelect } from "@/components/ui/multi-select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { documentsApi, tagsApi } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { Calendar, Clock, FileText, Filter, Info, Search as SearchIcon, Sparkles, Tag, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

export function SearchPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [isAccurate, setIsAccurate] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filters, setFilters] = useState<{ year: string[]; tags: string[] }>({
    year: [],
    tags: [],
  });
  const [searchParams, setSearchParams] = useState<{
    query: string;
    accurate?: boolean;
    year?: string[];
    tags?: string[];
  } | null>(null);

  const { data: tagOptions, isLoading: isTagOptionsLoading } = useQuery({
    queryKey: ["tags"],
    queryFn: () => tagsApi.getAll(),
    staleTime: 60,
  });

  const { data: yearOptions, isLoading: isYearOptionsLoading } = useQuery({
    queryKey: ["years"],
    queryFn: () => documentsApi.getAllYears(),
    staleTime: 60,
  });

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const queryParam = params.get("query");
    const accurateParam = params.get("accurate") === "true";
    const yearParam = params.get("year");
    const tagsParam = params.get("tags");

    if (queryParam) {
      setQuery(queryParam);
      setIsAccurate(accurateParam);
      setFilters({
        year: yearParam ? yearParam.split(',') : [],
        tags: tagsParam ? tagsParam.split(',') : [],
      });
      setSearchParams({
        query: queryParam,
        accurate: accurateParam,
        year: yearParam ? yearParam.split(',') : [],
        tags: tagsParam ? tagsParam.split(',') : [],
      });
    }
  }, [location.search]);

  const { data: results, isLoading } = useQuery({
    queryKey: ["search", searchParams],
    queryFn: () => documentsApi.search({
      query: searchParams!.query,
      accurate: searchParams!.accurate,
      year: searchParams?.year?.join(','),
      tags: searchParams?.tags?.join(','),
    }),
    enabled: !!searchParams?.query,
  });

  // Count active filters
  const activeFilterCount = (
    (filters.year && filters.year.length > 0 ? 1 : 0) +
    (filters.tags && filters.tags.length > 0 ? 1 : 0)
  );

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedQuery = query.trim();
    if (!trimmedQuery) return;

    const newParams = {
      query: trimmedQuery,
      accurate: isAccurate,
      year: filters.year,
      tags: filters.tags,
    };
    setSearchParams(newParams);

    // Update URL with search parameters
    const urlParams = new URLSearchParams();
    urlParams.set("query", trimmedQuery);
    urlParams.set("accurate", String(isAccurate));
    if (filters.year.length > 0) urlParams.set("year", filters.year.join(','));
    if (filters.tags.length > 0) urlParams.set("tags", filters.tags.join(','));
    navigate({ pathname: location.pathname, search: urlParams.toString() });
  };

  const handleYearFilterChange = (values: string[]) => {
    setFilters(prev => ({
      ...prev,
      year: values
    }));
  };

  const handleTagsFilterChange = (values: string[]) => {
    setFilters(prev => ({
      ...prev,
      tags: values
    }));
  };

  const clearFilters = () => {
    setFilters({
      year: [],
      tags: [],
    });
  };

  return (
    <div className="container max-w-4xl py-8 mx-auto">
      <Card className={cn(
        "mb-8 border-0 shadow-md bg-white",
        "transition-all duration-300 hover:shadow-lg",
        isAccurate && "bg-gradient-to-r from-white to-blue-50 border-l-4 border-l-primary"
      )}>
        <CardContent className="pt-6">
          <form onSubmit={handleSearch} className="flex flex-col gap-4">
            <div className="flex flex-col gap-4 md:flex-row">
              <div className="relative flex-1 group">
                <SearchIcon className={cn(
                  "absolute w-5 h-5 transition-colors transform -translate-y-1/2 left-3 top-1/2 text-muted-foreground",
                  "group-focus-within:text-primary",
                  isAccurate && "text-primary"
                )} />
                <Input
                  placeholder={isAccurate
                    ? "Ask any question about your documents..."
                    : "Search for document titles and summaries..."}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className={cn(
                    "h-12 pl-10 transition-all focus-visible:ring-2",
                    isAccurate
                      ? "focus-visible:ring-primary border-primary/20 bg-white/80"
                      : "focus-visible:ring-primary"
                  )}
                  autoFocus
                />
                {isAccurate && (
                  <Badge variant="secondary" className="absolute flex items-center gap-1 px-2 -translate-y-1/2 text-primary bg-primary/10 right-3 top-1/2">
                    <Sparkles className="w-3 h-3" />
                    <span className="text-xs font-medium">AI</span>
                  </Badge>
                )}
              </div>
              <Button type="submit" className={cn(
                "h-12 px-6 transition-all shadow-md",
                isAccurate && "bg-primary hover:bg-primary/90"
              )} disabled={!query.trim()}>
                <SearchIcon className="w-4 h-4 mr-2" />
                Search
              </Button>
            </div>

            <div className="flex items-center justify-between">
              <div className={cn(
                "flex flex-col gap-2 p-3 rounded-lg transition-all",
                isAccurate
                  ? "bg-blue-50 border border-primary/20"
                  : "hover:bg-slate-50"
              )}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={cn(
                      "p-1.5 rounded-md transition-colors",
                      isAccurate ? "bg-primary text-white" : "bg-slate-100"
                    )}>
                      {isAccurate
                        ? <Sparkles className="w-4 h-4" />
                        : <FileText className="w-4 h-4 text-slate-500" />
                      }
                    </div>
                    <div className="cursor-pointer select-none" onClick={() => setIsAccurate(!isAccurate)}>
                      <div className="flex items-center gap-2">
                        <label htmlFor="accurate-mode" className={cn(
                          "font-medium transition-colors",
                          isAccurate && "text-primary"
                        )}>
                          {isAccurate ? "AI-powered search" : "Standard search"}
                        </label>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="w-4 h-4 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs p-4 shadow-lg">
                              <p className="mb-2 font-medium">Search Modes:</p>
                              <div className="flex items-start gap-2 mb-2">
                                <FileText className="w-4 h-4 mt-0.5 text-slate-500" />
                                <div>
                                  <p className="font-medium">Standard Search</p>
                                  <p className="text-xs text-muted-foreground">Searches only titles and summaries. Fast but limited.</p>
                                </div>
                              </div>
                              <div className="flex items-start gap-2">
                                <Sparkles className="w-4 h-4 mt-0.5 text-primary" />
                                <div>
                                  <p className="font-medium text-primary">AI-powered Search</p>
                                  <p className="text-xs text-muted-foreground">Searches full document content and answers questions. More thorough but slightly slower.</p>
                                </div>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </div>
                  </div>
                  <Switch
                    id="accurate-mode"
                    checked={isAccurate}
                    onCheckedChange={setIsAccurate}
                    className={cn(
                      "data-[state=checked]:bg-primary",
                      "ml-4"
                    )}
                  />
                </div>

                <div className="flex items-center gap-3 ml-9">
                  <div className={cn(
                    "flex-1 text-xs px-2 py-1 rounded-md transition-colors",
                    isAccurate ? "text-primary/80 bg-white" : "text-muted-foreground"
                  )}>
                    {isAccurate
                      ? "Searches full document content and can answer specific questions"
                      : "Searches only titles and summaries"}
                  </div>
                </div>
              </div>

              <Popover open={isFilterOpen} onOpenChange={setIsFilterOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="flex items-center justify-between gap-2">
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
                      <Button variant="ghost" size="sm" onClick={clearFilters} className="h-8 text-xs">
                        Clear all
                      </Button>
                    )}
                  </div>

                  <div className="space-y-4">
                    {/* Year filter */}
                    <div className="grid gap-1.5">
                      <label htmlFor="year-filter" className="flex items-center gap-1 text-xs font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                        <Calendar className="h-3.5 w-3.5" />
                        Year
                      </label>
                      {isYearOptionsLoading ? (
                        <Skeleton className="h-9" />
                      ) : (
                        <MultiSelect
                          options={yearOptions.map(year => ({ value: year.toString(), label: year.toString() }))}
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
                          options={tagOptions.map(tag => ({ value: tag.id.toString(), label: tag.name }))}
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
          </form>
        </CardContent>
      </Card>

      {/* Active filters display */}
      {activeFilterCount > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
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
              {tagOptions?.find(t => t.id.toString() === tag)?.name || tag}
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
            <Button variant="ghost" size="sm" onClick={clearFilters} className="text-xs h-7">
              Clear all
            </Button>
          )}
        </div>
      )}

      {isLoading ? (
        <div className="space-y-8">
          <SearchSummarySkeleton />
          <div>
            <div className="flex items-center justify-between mb-6">
              <Skeleton className="h-6 w-28" />
              <Skeleton className="w-20 h-6" />
            </div>
            <div className="grid grid-cols-1 gap-8">
              {[...Array(3)].map((_, idx) => (
                <SearchDocumentCardSkeleton key={idx} />
              ))}
            </div>
          </div>
        </div>
      ) : (
        results && (
          <div className="space-y-8 transition-all">
            {results.summary && (
              <SearchSummary
                summary={results.summary}
                queryTime={results.query_time}
              />
            )}

            {results.sources && results.sources.length > 0 ? (
              <div>
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="flex items-center gap-1 px-2 py-1">
                      {isAccurate ? (
                        <Sparkles className="w-3 h-3 text-primary" />
                      ) : (
                        <FileText className="w-3 h-3" />
                      )}
                      <span className="text-sm">
                        {results.sources.length} {results.sources.length === 1 ? 'result' : 'results'} found
                      </span>
                    </Badge>
                  </div>
                  {results.query_time !== undefined && (
                    <Badge variant="outline" className="flex items-center gap-1 px-2 py-1 font-normal text-slate-600 bg-slate-100 border-slate-200">
                      <Clock className="w-3 h-3" />
                      {results.query_time.toFixed(2)}s
                    </Badge>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-8 animate-fadeIn">
                  {results.sources.map((source) => (
                    <SearchDocumentCard key={source.id} source={source} />
                  ))}
                </div>
              </div>
            ) : searchParams?.query ? (
              <Card className="p-8 text-center border-dashed">
                <div className="flex flex-col items-center">
                  <SearchIcon className="w-12 h-12 mb-4 text-muted-foreground" />
                  <h3 className="mb-2 text-xl font-medium">No results found</h3>
                  <p className="text-muted-foreground">
                    Try using different keywords or {!isAccurate && (
                      <span>enable <span className="font-medium underline cursor-pointer text-primary decoration-dotted"
                        onClick={() => {
                          setIsAccurate(true);
                          if (query.trim()) {
                            handleSearch(new Event('submit') as any);
                          }
                        }}>
                        AI-powered search
                      </span> to search within document content</span>
                    )}
                  </p>
                </div>
              </Card>
            ) : null}
          </div>
        )
      )}
    </div>
  );
}
